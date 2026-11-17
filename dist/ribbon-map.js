'use strict';

(() => {
  const scene = document.querySelector('.contact-scene');
  const stage = scene.querySelector('.ribbon-stage');
  const contact = stage.querySelector('.contact');
  const world = stage.querySelector('.ribbon-world');
  const canvas = world.querySelector('canvas');
  const index = world.querySelector('.ribbon-index');
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const motion = matchMedia('(prefers-reduced-motion: reduce)');
  const sections = ['contact', 'munly', 'core', 'about', 'home'];
  const count = sections.length, tau = 2 * Math.PI, turn = tau / count;
  const clamp = (n, min = 0, max = 1) => Math.min(max, Math.max(min, n));
  const lerp = (a, b, t) => a + (b-a)*t;
  const ease = (a, b, value) => { const t = clamp((value-a)/(b-a)); return t*t*(3-2*t); };
  const wrap = n => n - count*Math.round(n/count);
  const around = 20, across = 20;
  const points = [], faces = [], visibleFaces = [];
  const textures = new Map(), dirty = new Set(sections);
  let width = 0, height = 0, start = 0, span = 1, progress = 0;
  let frame = 0, near = false, lastTime = 0, ready = false;
  let spin = 0, lean = 0, velocity = 0, gesture = null, dive = null;
  let highlight = -1;

  for (let section = 0; section < count; section++) {
    const offset = points.length;
    for (let i = 0; i <= around; i++) {
      const x = i/around, u = Math.PI/2 - (section + x-.5)*turn;
      for (let j = 0; j <= across; j++) {
        const y = j/across;
        const v = Math.PI/2 + (.5-y)*tau;
        const point = ribbonPoint(u,v);
        // The underside lies directly behind the paper in its flat pose.
        point.flatY = y < .25 ? .5-2*y : y > .75 ? 2.5-2*y : 2*y-.5;
        points.push({...point, section, u:x, v:y, px:0, py:0, depth:0});
      }
    }
    for (let i = 0; i < around; i++) {
      for (let j = 0; j < across; j++) {
        const n = offset+i*(across+1)+j;
        const a=points[n], b=points[n+across+1], c=points[n+across+2], d=points[n+1];
        const bx=b.x-a.x, by=b.y-a.y, bz=b.z-a.z, dx=d.x-a.x, dy=d.y-a.y, dz=d.z-a.z;
        const nx=by*dz-bz*dy, ny=bz*dx-bx*dz, nz=bx*dy-by*dx;
        const size = Math.hypot(nx,ny,nz);
        faces.push({a,b,c,d,section,i,j, paper:j>=across/4 && j<3*across/4,
          nx:nx/size,ny:ny/size,nz:nz/size,depth:0,light:0});
      }
    }
  }

  function trace(a,b,c,d) {
    ctx.beginPath(); ctx.moveTo(a.px,a.py); ctx.lineTo(b.px,b.py); ctx.lineTo(c.px,c.py);
    if (d) ctx.lineTo(d.px,d.py);
    ctx.closePath();
  }

  // Each triangle samples only its rectangle of the printed page. The small overlap
  // covers antialiasing at shared edges without reading pixels from the page image.
  function printTriangle(image, a, b, d, sx, sy, sw, sh) {
    const xx=(b.px-a.px)/sw, xy=(b.py-a.py)/sw, yx=(d.px-a.px)/sh, yy=(d.py-a.py)/sh;
    ctx.save();
    ctx.transform(xx,xy,yx,yy,a.px,a.py);
    const padX=Math.min(Math.abs(sw)*.05,.45/(Math.hypot(xx,xy)||1));
    const padY=Math.min(Math.abs(sh)*.05,.45/(Math.hypot(yx,yy)||1));
    const ex=Math.sign(sw)*padX, ey=Math.sign(sh)*padY;
    ctx.beginPath(); ctx.moveTo(-ex,-ey); ctx.lineTo(sw+2*ex,-ey); ctx.lineTo(-ex,sh+2*ey); ctx.closePath(); ctx.clip();
    const x=Math.min(sx,sx+sw), y=Math.min(sy,sy+sh);
    const x0=Math.max(0,x-padX), y0=Math.max(0,y-padY);
    const w=Math.min(image.width,x+Math.abs(sw)+padX)-x0;
    const h=Math.min(image.height,y+Math.abs(sh)+padY)-y0;
    ctx.drawImage(image,x0,y0,w,h,x0-sx,y0-sy,w,h);
    ctx.restore();
  }

  function render(pose) {
    const {turns, pitch, bank, whole, bend, flatSection} = pose;
    const co=Math.cos(turns*turn), si=Math.sin(turns*turn);
    const cp=Math.cos(pitch), sp=Math.sin(pitch), cb=Math.cos(bank), sb=Math.sin(bank);
    const anchor = ribbonPoint(Math.PI/2 - turns*turn, Math.PI/2);
    const pivotY = 1.35*(1-whole), pivotZ = anchor.z*(1-whole);
    const orbitScale = Math.min(width*.255, height*.244);
    const scale = lerp(Math.min(width*(width<640 ? .73 : .52),height*1.04),orbitScale,whole);
    const midY = height*lerp(.49,.435,whole);
    for (const p of points) {
      const x=p.x*co-p.y*si, y=p.x*si+p.y*co-pivotY, z=p.z-pivotZ;
      const vy=y*cp-z*sp, depth=y*sp+z*cp;
      const k=scale*5.5/(5.5-depth);
      const gx=width*.5+(x*cb-vy*sb)*k, gy=midY+(x*sb+vy*cb)*k;
      const flatX = wrap(p.section-flatSection) + p.u;
      p.px=lerp(flatX*width,gx,bend);
      p.py=lerp(p.flatY*height,gy,bend);
      const underside = p.v<.25 || p.v>.75;
      p.depth=lerp(underside ? -.09 : .01,depth,bend);
    }
    ctx.clearRect(0,0,width,height);
    if (bend<.0001) {
      ctx.drawImage(textures.get(sections[flatSection]),0,0,width,height);
      visibleFaces.length=0;
      return;
    }
    if (whole > .02) {
      ctx.save(); ctx.translate(width*.5,height*.435+orbitScale*1.86); ctx.scale(orbitScale*1.52,orbitScale*.14);
      const shadow=ctx.createRadialGradient(0,0,0,0,0,1);
      shadow.addColorStop(0,'rgba(0,0,0,'+(.42*whole)+')');shadow.addColorStop(1,'rgba(0,0,0,0)');
      ctx.fillStyle=shadow;ctx.fillRect(-1,-1,2,2);ctx.restore();
    }
    visibleFaces.length=0;
    for (const f of faces) {
      const {a,b,c,d} = f;
      const area=(b.px-a.px)*(d.py-a.py)-(b.py-a.py)*(d.px-a.px);
      if (area<=.003 || Math.max(a.px,b.px,c.px,d.px)<0 || Math.min(a.px,b.px,c.px,d.px)>width ||
          Math.max(a.py,b.py,c.py,d.py)<0 || Math.min(a.py,b.py,c.py,d.py)>height) continue;
      f.depth=a.depth+b.depth+c.depth+d.depth;
      const nx=f.nx*co-f.ny*si, ny=f.nx*si+f.ny*co;
      f.light=clamp(-.38*nx-.48*(ny*cp-f.nz*sp)+.8*(ny*sp+f.nz*cp));
      visibleFaces.push(f);
    }
    visibleFaces.sort((a,b)=>a.depth-b.depth);
    for (const f of visibleFaces) {
      const {a,b,c,d}=f;
      if (f.paper) {
        const image=textures.get(sections[f.section]);
        const w=image.width/around, h=image.height/(across*.5);
        const x=f.i*w,y=(f.j-across/4)*h;
        // At the overview scale most cells project to parallelograms within a
        // fraction of a pixel. One sampled patch is sufficient at that scale.
        const errorX=a.px+c.px-b.px-d.px, errorY=a.py+c.py-b.py-d.py;
        if (errorX*errorX+errorY*errorY<.12) {
          ctx.save();
          ctx.transform((b.px-a.px)/w,(b.py-a.py)/w,(d.px-a.px)/h,(d.py-a.py)/h,a.px,a.py);
          const mx=Math.min(.8,.28*w/(Math.hypot(b.px-a.px,b.py-a.py)||1));
          const my=Math.min(.8,.28*h/(Math.hypot(d.px-a.px,d.py-a.py)||1));
          ctx.drawImage(image,x,y,w,h,-mx,-my,w+2*mx,h+2*my);
          ctx.restore();
        } else {
          printTriangle(image,a,b,d,x,y,w,h);
          printTriangle(image,c,d,b,x+w,y+h,-w,-h);
        }
        if (bend>.04) {
          trace(a,b,c,d);
          ctx.fillStyle='rgba(23,29,20,'+(bend*(.025+.22*(1-f.light)))+')'; ctx.fill();
        }
        if (f.section===highlight && !dive && progress>=.945) {
          ctx.beginPath();
          if (f.i===0) {ctx.moveTo(a.px,a.py);ctx.lineTo(d.px,d.py);}
          if (f.i===around-1) {ctx.moveTo(b.px,b.py);ctx.lineTo(c.px,c.py);}
          if (f.j===across/4) {ctx.moveTo(a.px,a.py);ctx.lineTo(b.px,b.py);}
          if (f.j===3*across/4-1) {ctx.moveTo(d.px,d.py);ctx.lineTo(c.px,c.py);}
          ctx.strokeStyle='#f6e7a9';ctx.lineWidth=1.9;ctx.stroke();
        }
      } else {
        const tone=Math.round(100+121*f.light);
        ctx.fillStyle='rgb('+(tone+9)+','+(tone+5)+','+(tone-10)+')';
        trace(a,b,c,d); ctx.fill(); ctx.strokeStyle=ctx.fillStyle; ctx.lineWidth=.65; ctx.stroke();
      }
    }
  }

  function scrollPose() {
    const whole=ease(.65,.95,progress);
    const turns=ease(.19,.43,progress)+ease(.47,.69,progress)+.36*whole+spin*ease(.68,.945,progress);
    return {turns,whole,bend:ease(.045,.38,progress),pitch:lerp(-.08,.64,whole)+lean*ease(.68,.945,progress),
      bank:lerp(-.09,-.5,whole),flatSection:0};
  }

  function draw(now) {
    frame=0;
    if (!near || document.hidden || !width || !height) return;
    const dt=lastTime?Math.min(50,now-lastTime):16;
    lastTime=now;
    progress=motion.matches ? 1 : clamp((scrollY-start)/span);
    const interactive=progress>=.945;
    if (!interactive && !dive) {
      velocity=0;gesture=null;setHighlight(-1);
      if (progress<=.68) {spin=0;lean=0;}
    }
    const showIndex=interactive && !dive;
    world.classList.toggle('is-open', showIndex);
    index.inert=!showIndex;
    canvas.tabIndex=showIndex?0:-1;
    scene.style.setProperty('--index-opacity',dive?0:ease(.91,.98,progress));
    scene.style.setProperty('--contact-paper',motion.matches?1:1-ease(.015,.057,progress));
    contact.inert=!motion.matches && progress>.06;
    if (progress<=.001 && !dive) {ready=false; return;}
    if (!ready) {dirty.add('contact');ready=true;}
    if (dirty.has('contact')) contact.classList.add('ribbon-printing');
    for (const key of dirty) textures.set(key,printRibbonPage(key,width,height));
    if (dirty.has('contact')) contact.classList.remove('ribbon-printing');
    dirty.clear();
    if (velocity && !gesture && !dive && !motion.matches) {
      const decay=Math.exp(-dt/270);
      spin+=velocity*270*(1-decay); velocity*=decay;
      if (Math.abs(velocity)<.000012) velocity=0;
    }
    let pose=scrollPose();
    if (dive) {
      const t=clamp((now-dive.start)/740), zoom=ease(.14,1,t);
      pose={turns:lerp(dive.pose.turns,dive.turns,ease(0,.68,t)),whole:1-zoom,
        pitch:lerp(dive.pose.pitch,-.08,zoom),bank:lerp(dive.pose.bank,0,zoom),
        bend:1-ease(.53,1,t),flatSection:dive.section};
      render(pose);
      if (t===1) {land(dive.section,true);return;}
    } else render(pose);
    if (velocity || dive) schedule();
  }
  function schedule() {if (near && !document.hidden && !frame) frame=requestAnimationFrame(draw);}

  function measure() {
    const r=canvas.getBoundingClientRect();
    const dpr=Math.min(devicePixelRatio||1,1.65);
    if (r.width!==width || r.height!==height || canvas.width!==Math.round(r.width*dpr)) {
      width=r.width;height=r.height;
      canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
      ctx.setTransform(dpr,0,0,dpr,0,0);
      dirty.add('contact');
    }
    start=scene.getBoundingClientRect().top+scrollY;
    span=Math.max(1,scene.offsetHeight-stage.offsetHeight);
    schedule();
  }

  function land(section, fade) {
    const key=sections[section];
    let overlay;
    if (fade) {
      overlay=document.createElement('canvas');
      overlay.className='ribbon-dive-frame';overlay.setAttribute('aria-hidden','true');
      overlay.width=canvas.width;overlay.height=canvas.height;
      overlay.getContext('2d').drawImage(canvas,0,0);document.body.append(overlay);
    }
    const project=key==='core'||key==='munly';
    if (project) document.querySelector('.project-picker [aria-controls="'+key+'-project"]').click();
    const destination=document.getElementById(project?'work':key);
    const focus=project ? document.getElementById(key==='core'?'core-title':'folio-title') :
      key==='about' ? destination.querySelector('h2') : key==='contact' ? contact.querySelector('a') : destination.querySelector('h1');
    const anchor=project?'work':key;
    const extra=key==='about' && document.documentElement.classList.contains('motion-wide') ?
      Math.max(0,(destination.offsetHeight-innerHeight)*.76) : 0;
    const top=key==='home'?0:destination.getBoundingClientRect().top+scrollY+extra;
    dive=null;gesture=null;velocity=0;spin=0;lean=0;
    contact.inert=false;
    if(location.hash!=='#'+anchor) {
      try {history.pushState(null,'','#'+anchor);} catch {}
    }
    window.scrollTo({top,behavior:'instant'});
    if (!focus.matches('a, button, [tabindex]')) focus.tabIndex=-1;
    focus.focus({preventScroll:true});
    if (overlay) {
      const dissolve=overlay.animate?.([{opacity:1},{opacity:0}],{duration:230,easing:'ease-out'});
      if(dissolve)dissolve.onfinish=()=>overlay.remove(); else overlay.remove();
    }
    schedule();
  }
  function enter(section) {
    if (dive || section<0) return;
    velocity=0;
    if (motion.matches) {land(section,false);return;}
    const pose=scrollPose();
    dive={section,pose,turns:pose.turns+wrap(section-pose.turns),start:performance.now()};
    schedule();
  }

  function inside(p,q,r,x,y) {
    const side=(a,b)=>(b.px-a.px)*(y-a.py)-(b.py-a.py)*(x-a.px);
    const ab=side(p,q),bc=side(q,r),ca=side(r,p);
    return (ab>=0 && bc>=0 && ca>=0)||(ab<=0 && bc<=0 && ca<=0);
  }
  function pick(x,y) {
    for (let i=visibleFaces.length-1;i>=0;i--) {
      const {a,b,c,d,section}=visibleFaces[i];
      if (inside(a,b,c,x,y)||inside(a,c,d,x,y)) return section;
    }
    return -1;
  }
  const links=[...index.querySelectorAll('a')];
  function setHighlight(section) {
    if (highlight===section) return;
    highlight=section;
    canvas.classList.toggle('is-over',section>=0);
    for(const link of links) link.classList.toggle('lit',link.dataset.ribbon===sections[section]);
    schedule();
  }
  for(const link of links) {
    const aim=()=>setHighlight(sections.indexOf(link.dataset.ribbon));
    link.addEventListener('pointerenter',aim);
    link.addEventListener('focus',aim);
    link.addEventListener('pointerleave',()=>setHighlight(-1));
    link.addEventListener('blur',()=>setHighlight(-1));
  }
  canvas.addEventListener('pointerleave',()=>setHighlight(-1));
  canvas.addEventListener('pointerdown',event=>{
    if (!world.classList.contains('is-open') || event.button!==0 || gesture || dive) return;
    gesture={id:event.pointerId,x:event.clientX,y:event.clientY,lastX:event.clientX,lastY:event.clientY,
      time:event.timeStamp,moved:false};
    velocity=0;canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove',event=>{
    if (!gesture) {
      if(event.pointerType==='mouse' && world.classList.contains('is-open')) {
        const r=canvas.getBoundingClientRect();setHighlight(pick(event.clientX-r.left,event.clientY-r.top));
      }
      return;
    }
    if (event.pointerId!==gesture.id) return;
    if (!gesture.moved && Math.hypot(event.clientX-gesture.x,event.clientY-gesture.y)<6) return;
    gesture.moved=true;setHighlight(-1);
    const dx=(event.clientX-gesture.lastX)/Math.max(230,width*.6)*3;
    spin+=dx;
    lean=clamp(lean+(event.clientY-gesture.lastY)/Math.max(160,height)*1.5,-.68,.62);
    velocity=motion.matches?0:clamp(dx/Math.max(8,event.timeStamp-gesture.time),-.009,.009);
    gesture.lastX=event.clientX;gesture.lastY=event.clientY;gesture.time=event.timeStamp;schedule();
  });
  function release(event) {
    if (event.pointerId!==gesture?.id) return;
    const tap=!gesture.moved && event.type==='pointerup';
    if (event.type!=='pointerup' || event.timeStamp-gesture.time>90) velocity=0;
    gesture=null;
    if (tap) {
      const r=canvas.getBoundingClientRect();
      enter(pick(event.clientX-r.left,event.clientY-r.top));
    }
    schedule();
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) canvas.addEventListener(type,release);
  canvas.addEventListener('keydown',e=>{
    if (!world.classList.contains('is-open') || dive) return;
    if (e.key==='ArrowLeft'||e.key==='ArrowRight') {
      e.preventDefault();velocity=0;spin+=e.key==='ArrowRight'?.28:-.28;schedule();
    } else if (e.key==='Enter') {
      e.preventDefault();const front=Math.round(scrollPose().turns);
      enter((front%count+count)%count);
    }
  });
  for (const link of index.querySelectorAll('a')) link.addEventListener('click',e=>{
    if(e.metaKey||e.ctrlKey||e.shiftKey||e.altKey)return;
    e.preventDefault();enter(sections.indexOf(link.dataset.ribbon));
  });
  function refresh(key) {dirty.add(key);schedule();}
  const folio=document.querySelector('.folio-table');
  new MutationObserver(()=>refresh('munly')).observe(folio,{attributes:true,attributeFilter:['aria-pressed']});
  folio.querySelector('img').addEventListener('load',()=>refresh('munly'));
  function mode() {
    if (dive && motion.matches) land(dive.section,false);
    scene.classList.toggle('is-still',motion.matches);
    contact.inert=false;gesture=null;velocity=0;
    measure();
  }
  world.hidden=false;scene.classList.add('ribbon-on');
  new ResizeObserver(measure).observe(stage);
  new ResizeObserver(measure).observe(document.body);
  new IntersectionObserver(([entry])=>{
    near=entry.isIntersecting;
    if (near) {lastTime=0;measure();}
    else {velocity=0;gesture=null;dive=null;}
  }).observe(stage);
  addEventListener('resize',measure,{passive:true});
  addEventListener('scroll',()=>{if (dive) dive=null;if(!motion.matches)schedule();},{passive:true});
  document.addEventListener('visibilitychange',()=>{lastTime=0;velocity=0;gesture=null;schedule();});
  document.fonts.ready.then(()=>{for(const key of sections)dirty.add(key);measure();});
  motion.addEventListener('change',mode);
  mode();
})();
