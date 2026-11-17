'use strict';
document.documentElement.classList.add('js');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
motionPreference.addEventListener('change', () => { reduced = motionPreference.matches; });
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const observer=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('visible');observer.unobserve(e.target)}}),{threshold:.08});$$('.reveal').forEach(e=>observer.observe(e));
$$('.magnetic').forEach(e=>{e.addEventListener('pointermove',ev=>{if(reduced||innerWidth<760)return;const r=e.getBoundingClientRect();e.style.transform=`translate(${(ev.clientX-r.left-r.width/2)*.025}px,${(ev.clientY-r.top-r.height/2)*.05}px)`});e.addEventListener('pointerleave',()=>e.style.transform='')});
(() => {
  const motion=matchMedia('(prefers-reduced-motion: reduce)');
  const wide=matchMedia('(min-width: 900px) and (min-height: 650px)');
  const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
  const ease=v=>{v=clamp(v);return v*v*(3-2*v)};
  const root=document.documentElement;
  const about=$('.about-scene'),aboutPanel=$('.about');
  const table=$('.project-directory');
  const contact=$('.contact'),contactScene=$('.contact-scene'),ticker=$('.ticker div');
  const paragraphs=$$('.about-copy > *'),contactLines=$$('.contact-line');
  function splitWords(element,className){
    const result=[],walker=document.createTreeWalker(element,NodeFilter.SHOW_TEXT),nodes=[];
    while(walker.nextNode())nodes.push(walker.currentNode);
    nodes.forEach(node=>{
      const fragment=document.createDocumentFragment();
      node.textContent.split(/(\s+)/).forEach(word=>{
        if(!word.trim()){fragment.append(document.createTextNode(word));return}
        const span=document.createElement('span');span.className=className;span.textContent=word;
        result.push(span);fragment.append(span);
      });
      node.replaceWith(fragment);
    });
    return result;
  }
  const words=splitWords($('.about h2'),'reading-word');
  const progressBar=$('.scroll-progress');
  let frame=0,lastTime=0,visualY=window.scrollY,geometry,enabled=false,panoramic=false;
  const set=(el,key,value)=>el.style.setProperty(key,value);
  const position=el=>({top:el.getBoundingClientRect().top+window.scrollY,height:el.offsetHeight});
  function measure(){
    enabled=!motion.matches;panoramic=enabled&&wide.matches;
    root.classList.toggle('immersive',enabled);
    root.classList.toggle('motion-wide',panoramic);
    geometry={
      work:position(table),about:position(about),contact:position(contactScene),ticker:position($('.ticker')),
      max:Math.max(0,root.scrollHeight-innerHeight)
    };
    visualY=window.scrollY;lastTime=0;schedule();
  }
  function draw(time){
    frame=0;
    if(document.hidden)return;
    const actual=window.scrollY,h=innerHeight;
    const dt=lastTime?Math.min(64,time-lastTime):16.67;lastTime=time;
    if(!enabled)visualY=actual;
    else visualY+=(actual-visualY)*(1-Math.exp(-dt/85));
    if(Math.abs(actual-visualY)<.1)visualY=actual;
    const overall=geometry.max?clamp(actual/geometry.max):0;
    progressBar.style.transform=`scaleX(${overall})`;
    if(enabled){
      const strength=wide.matches?1:.4;
      const entrance=ease((visualY+h-geometry.work.top)/(h*.72));
      set(table,'--arrival-y', ((1-entrance)*54*strength)+'px');
      set(table,'--table-light', (30+entrance*28)+'%');
      const read=panoramic
        ?clamp((visualY-geometry.about.top)/Math.max(1,geometry.about.height-h))
        :clamp((visualY-geometry.about.top+h*.45)/Math.max(1,geometry.about.height-h*.2));
      words.forEach((word,i)=>{
        const light=ease(read*(words.length+1.5)-i);
        set(word,'--word-light',.08+.92*light);
        set(word,'--word-lift',`${(1-light)*90*strength}px`);
        set(word,'--word-fold',`${(1-light)*65*strength}deg`);
        set(word,'--word-blur',`${(1-light)*(panoramic?5:0)}px`);
      });
      paragraphs.forEach((paragraph,i)=>{
        const shown=ease(read*1.8-.18-i*.14);
        set(paragraph,'--paragraph-y',`${(1-shown)*55*strength}px`);
        set(paragraph,'--paragraph-opacity',.15+.85*shown);
      });
      set(aboutPanel,'--orbit-shape',`${42-read*25}%`);
      set(aboutPanel,'--orbit-scale',.8+read*.4);
      const copy=ease((read-.25)/.4);
      set(aboutPanel,'--about-copy-opacity',.35+copy*.65);
      set(aboutPanel,'--about-copy-y',`${(1-copy)*45}px`);
      set(aboutPanel,'--about-orbit',`${read*110}deg`);
      const ending=ease((visualY+h-geometry.contact.top)/(h*.9));
      contactLines.forEach((line,i)=>{
        const shown=ease((ending-i*.12)/.78);
        set(line,'--contact-line-x',`${(i===0?-1:1)*(1-shown)*innerWidth*.1*strength}px`);
        set(line,'--contact-line-y',`${(1-shown)*170*strength}px`);
        set(line,'--contact-line-fold',`${(1-shown)*35*strength}deg`);
        set(line,'--contact-line-mask',`${(1-shown)*100}%`);
      });
      set(contact,'--contact-arrow-turn',`${(1-ending)*-60}deg`);
      set(contact,'--contact-arrow-scale',.65+ending*.35);
      const bottom=ease((ending-.35)/.5);
      set(contact,'--contact-bottom-y',`${(1-bottom)*48*strength}px`);
      set(contact,'--contact-bottom-opacity',bottom);
      set(contact,'--contact-mask',`${(1-ending)*80}%`);
      set(contact,'--contact-radius',`${(1-ending)*100}px`);
      set(contact,'--contact-ring',`${-45+ending*90}deg`);
      // Modulo keeps the repeated ticker filled even on very long pages.
      const repeat=ticker.scrollWidth/6;
      const shift=(actual-geometry.ticker.top)*.38;
      ticker.style.transform=`translate3d(${repeat?-((shift%repeat+repeat)%repeat):0}px,0,0)`;
    }else{
      ticker.style.transform='';
    }
    if(enabled&&visualY!==actual)schedule();
  }
  function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
  const inView=new IntersectionObserver(entries=>entries.forEach(entry=>entry.target.classList.toggle('motion-active',entry.isIntersecting)),{threshold:.01});
  [$('.ticker'),contact].forEach(element=>inView.observe(element));
  addEventListener('scroll',schedule,{passive:true});
  addEventListener('resize',measure,{passive:true});
  motion.addEventListener('change',measure);
  wide.addEventListener('change',measure);
  document.addEventListener('visibilitychange',()=>{root.classList.toggle('motion-suspended',document.hidden);visualY=window.scrollY;lastTime=0;schedule()});
  new ResizeObserver(measure).observe(document.body);
  document.fonts.ready.then(measure);
  measure();
})();
