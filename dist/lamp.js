'use strict';

(() => {
  // Browsers group typed addresses, bookmarks and other direct entries together.
  // Decide per navigation so a later direct visit in the same tab can play again.
  const entry = performance.getEntriesByType?.('navigation')?.[0];
  const fresh = entry ? entry.type === 'navigate' : performance.navigation?.type === 0;
  if (!fresh || document.referrer || location.hash) return;

  const root = document.documentElement;
  root.classList.add('lamp-pending');
  function start() {
    const dialog = document.querySelector('.entry-lamp');
    const canvas = dialog?.querySelector('.lamp-art');
    const ctx = canvas?.getContext('2d');
    if (!ctx || typeof dialog.showModal !== 'function') {
      root.classList.remove('lamp-pending');
      return;
    }
    const rig = dialog.querySelector('.lamp-rig');
    const bead = dialog.querySelector('.lamp-switch');
    const hint = bead.querySelector('span');
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const anchorX = 200, anchorY = 172, length = 127;
    const clamp = (v,min,max) => Math.min(max,Math.max(min,v));
    let angle = reduced.matches ? 0 : .11, angularSpeed = 0, stretch = 0, stretchSpeed = 0;
    let targetAngle = angle, targetStretch = 0, drag = null, armed = false, suppressClick = false;
    let phase = 'off', frame = 0, previous = 0, ignition = 0, unit = 1;
    let tipX = anchorX, tipY = anchorY + length;

    function metal(x1,y1,x2,y2,stops) {
      const gradient = ctx.createLinearGradient(x1,y1,x2,y2);
      for (const [offset,tone] of stops) gradient.addColorStop(offset,tone);
      return gradient;
    }
    function ellipse(x,y,rx,ry,fill) {
      ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2);ctx.fillStyle=fill;ctx.fill();
    }
    const brass = [[0,'#594624'],[.17,'#a68a50'],[.37,'#e2c78a'],[.58,'#ab9056'],[.82,'#76603a'],[1,'#4f4027']];
    function paint(light) {
      ctx.clearRect(0,0,320,450);
      // A single folded shade, suspended from a fine cord.
      ctx.fillStyle='#42483f';ctx.fillRect(159,-2,2,111);
      ctx.beginPath();ctx.moveTo(151,110);ctx.quadraticCurveTo(160,107,169,110);
      ctx.lineTo(254,170);ctx.quadraticCurveTo(257,173,251,174);
      ctx.quadraticCurveTo(160,181,69,174);ctx.quadraticCurveTo(63,173,66,170);
      ctx.closePath();
      ctx.fillStyle=metal(75,126,240,166,[[0,'#4a5144'],[.38,'#394037'],[1,'#222922']]);ctx.fill();
      ellipse(160,173,92,4,light?'#e7d9ae':'#606452');
      ellipse(160,175,10,3.5,light?'#fff0c7':'#454b40');

      // A compressed cord bows sideways. Under tension it straightens along the pull.
      tipX=anchorX+Math.sin(angle)*(length+stretch);
      tipY=anchorY+Math.cos(angle)*(length+stretch);
      const bow=angle*13 + Math.max(0,-stretch)*.45;
      const midX=(anchorX+tipX)*.5+bow, midY=(anchorY+tipY)*.5+Math.abs(bow)*.24;
      ctx.beginPath();ctx.moveTo(anchorX,anchorY);ctx.quadraticCurveTo(midX,midY,tipX,tipY);
      ctx.strokeStyle='#7f7656';ctx.lineWidth=2.1;ctx.stroke();
      ctx.setLineDash([1.1,3.3]);ctx.strokeStyle='#d4c395';ctx.lineWidth=1.25;ctx.stroke();ctx.setLineDash([]);
      ctx.save();ctx.translate(tipX,tipY);ctx.rotate(-angle*.8);
      ctx.fillStyle=metal(-3,0,3,0,brass);ctx.fillRect(-3,-7,6,8);
      ctx.beginPath();ctx.moveTo(-4,-1);ctx.bezierCurveTo(-4,2,-8,4,-8,12);
      ctx.bezierCurveTo(-8,23,8,23,8,12);ctx.bezierCurveTo(8,4,4,2,4,-1);ctx.closePath();
      ctx.fillStyle=metal(-8,0,8,0,brass);ctx.fill();ctx.restore();
      bead.style.left=(tipX/320*100)+'%';bead.style.top=((tipY+9)/450*100)+'%';
    }

    function measure() {
      const rect=rig.getBoundingClientRect();
      if(!rect.width)return;
      unit=rect.width/320;
      const resolution=Math.min(devicePixelRatio||1,2);
      canvas.width=Math.round(rect.width*resolution);canvas.height=Math.round(rect.height*resolution);
      ctx.setTransform(canvas.width/320,0,0,canvas.height/450,0,0);
      const x=rect.left+160*unit,y=rect.top+179*unit;
      dialog.style.setProperty('--light-x',x+'px');dialog.style.setProperty('--light-y',y+'px');
      paint(phase==='lighting');
    }
    function finish() {
      if(phase==='done')return;
      phase='done';cancelAnimationFrame(frame);frame=0;drag=null;
      root.classList.remove('lamp-pending','lamp-off');
      if(dialog.open)dialog.close();
      observer.disconnect();reduced.removeEventListener('change',motionChanged);
      removeEventListener('resize',measure);removeEventListener('pagehide',finish);
      removeEventListener('pageshow',restore);removeEventListener('hashchange',finish);
      document.removeEventListener('visibilitychange',visibilityChanged);
    }
    function ignite() {
      if(phase!=='off')return;
      phase='lighting';ignition=performance.now();drag=null;
      dialog.classList.add('ignited');
      if(reduced.matches) {finish();return;}
      // The spring starts from the user's actual displaced bead and pulls back past rest.
      stretchSpeed=Math.min(stretchSpeed,-Math.max(0,stretch)*3);
      schedule();
    }
    function step(now) {
      frame=0;
      if(document.hidden||phase==='done')return;
      const dt=Math.min(.045,(now-(previous||now-16))/1000);previous=now;
      if(!reduced.matches) {
        for(let i=0;i<4;i++) {
          const h=dt/4;
          angularSpeed+=h*(drag ? (targetAngle-angle)*430-angularSpeed*31 : -23*Math.sin(angle)-angularSpeed*2.35);
          stretchSpeed+=h*(drag ? (targetStretch-stretch)*540-stretchSpeed*36 : -370*stretch-stretchSpeed*8.8);
          angle+=angularSpeed*h;stretch+=stretchSpeed*h;
        }
      }
      paint(phase==='lighting');
      if(phase==='lighting') {
        const ms=now-ignition;
        const exposure=clamp((ms-35)/1160,0,1);
        const lift=clamp((ms-335)/720,0,1);
        dialog.style.setProperty('--veil-opacity',String(1-exposure*exposure*(3-2*exposure)));
        dialog.style.setProperty('--glow',String(.12*Math.sin(exposure*Math.PI)));
        dialog.style.setProperty('--rig-y',(-100*lift*lift*(2-lift))+'%');
        if(ms>=1480){finish();return;}
      }
      if(!reduced.matches && (phase==='lighting'||Math.abs(angle)+Math.abs(angularSpeed)>.001||
        Math.abs(stretch)+Math.abs(stretchSpeed)>.04||drag))schedule();
    }
    function schedule() {
      if(!frame && phase!=='done' && !document.hidden)frame=requestAnimationFrame(step);
    }
    function pull(event) {
      if(!drag || event.pointerId!==drag.id)return;
      const dx=event.clientX-drag.x,dy=event.clientY-drag.y;
      drag.travel=Math.max(drag.travel,Math.hypot(dx,dy));
      const x=drag.tipX-anchorX+dx/unit, y=Math.max(35,drag.tipY-anchorY+dy/unit);
      targetAngle=clamp(Math.atan2(x,y),-.92,.92);
      const extension=Math.hypot(x,y)-length;
      targetStretch=extension>0?92*(1-Math.exp(-extension/96)):Math.max(-26,extension*.42);
      const next=dy>=(armed?38:45);
      if(armed!==next){
        armed=next;hint.textContent=armed?'Release to turn on':'Pull to turn on';
        if(armed)targetStretch+=3;
      }
      if(reduced.matches){angle=targetAngle;stretch=targetStretch;paint(false);}else schedule();
    }
    bead.addEventListener('pointerdown',event=>{
      if(phase!=='off'||drag||event.button!==0)return;
      suppressClick=false;armed=false;
      drag={id:event.pointerId,x:event.clientX,y:event.clientY,tipX,tipY,travel:0};
      targetAngle=angle;targetStretch=stretch;bead.setPointerCapture(event.pointerId);
      previous=performance.now();schedule();
    });
    bead.addEventListener('pointermove',pull);
    function release(event) {
      if(!drag || event.pointerId!==drag.id)return;
      const committed=event.type==='pointerup';
      if(committed)pull(event);
      const activate=committed && armed;
      suppressClick=!committed||drag.travel>6;
      drag=null;armed=false;hint.textContent='Pull to turn on';
      if(activate){
        // Even a flick completed between two frames carries its displacement into the spring.
        stretch=Math.max(stretch,targetStretch*.8);angle+=(targetAngle-angle)*.45;
        ignite();return;
      }
      if(reduced.matches){angle=stretch=0;paint(false);}else schedule();
    }
    for(const type of ['pointerup','pointercancel','lostpointercapture'])bead.addEventListener(type,release);
    bead.addEventListener('click',event=>{
      if(!suppressClick||event.detail===0)ignite();
      suppressClick=false;
    });
    dialog.addEventListener('cancel',event=>{event.preventDefault();finish();});
    function motionChanged() {
      if(reduced.matches){angle=angularSpeed=stretch=stretchSpeed=0;if(phase==='lighting'){finish();return;}}
      schedule();
    }
    function visibilityChanged() {
      if(document.hidden){
        drag=null;armed=false;suppressClick=true;hint.textContent='Pull to turn on';
        if(phase==='lighting')finish();
      } else {previous=0;schedule();}
    }
    function restore(event) {if(event.persisted)finish();}
    const observer=new ResizeObserver(measure);
    // Opening the native dialog also gives the switch keyboard focus and isolates the background.
    try {dialog.showModal();} catch {finish();return;}
    root.classList.add('lamp-off');root.classList.remove('lamp-pending');
    observer.observe(rig);addEventListener('resize',measure,{passive:true});
    reduced.addEventListener('change',motionChanged);
    addEventListener('pagehide',finish);addEventListener('pageshow',restore);addEventListener('hashchange',finish);
    document.addEventListener('visibilitychange',visibilityChanged);
    measure();schedule();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});
  else start();
})();
