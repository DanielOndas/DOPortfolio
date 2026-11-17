'use strict';
document.documentElement.classList.add('js');
const motionPreference = matchMedia('(prefers-reduced-motion: reduce)');
let reduced = motionPreference.matches;
motionPreference.addEventListener('change', () => { reduced = motionPreference.matches; });
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];

const chapters = $$('.experience-main > section');
const chapterLinks = $$('.chapter-links a');
const intro = $('.experience-intro');
const timeline = $('#evolution');
const pageProgress = $('.scroll-progress');
let scrollFrame = 0;
const clamp = value => Math.max(0, Math.min(1, value));
const ease = value => { const t = clamp(value); return t * t * (3 - 2 * t); };

function drawExperience() {
  scrollFrame = 0;
  const height = window.innerHeight;
  const positions = chapters.map(section => section.getBoundingClientRect().top);
  const introRect = intro.getBoundingClientRect();
  const maxScroll = document.documentElement.scrollHeight - height;
  const atEnd = maxScroll > 0 && scrollY >= maxScroll - 2;
  const current = atEnd ? chapters.length - 1 : positions.reduce((index, top, i) => top <= height * .42 ? i : index, 0);
  chapterLinks.forEach((link, i) => {
    if (i === current) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  pageProgress.style.transform = 'scaleX(' + clamp(scrollY / Math.max(1, maxScroll)) + ')';
  if (reduced) return;

  const progress = clamp(-introRect.top / Math.max(1, introRect.height - height));
  const lift = ease(progress / .55);
  const wipe = ease((progress - .3) / .58);
  const diagonal = Math.sin(wipe * Math.PI) * 6;
  const set = (key, value) => intro.style.setProperty(key, value);
  set('--scene-title-y', -height * .16 * lift + 'px');
  set('--scene-title-opacity', 1 - lift);
  set('--screen-y', height * .13 * (1 - lift) + 'px');
  set('--screen-tilt', 24 * (1 - lift) + 'deg');
  set('--screen-yaw', -20 * (1 - lift) + 'deg');
  set('--screen-rotate', -6 * (1 - lift) + 'deg');
  set('--screen-scale', .65 + .45 * lift);
  set('--reveal-top', wipe * 100 + diagonal + '%');
  set('--reveal-bottom', wipe * 100 - diagonal + '%');
  const arrival = 1 - ease((height - positions[1]) / (height * .65));
  timeline.style.setProperty('--panel-lift', arrival * 80 + 'px');
  timeline.style.setProperty('--panel-tilt', arrival * 13 + 'deg');
  timeline.style.setProperty('--panel-scale', 1 - arrival * .07);

}
function scheduleExperience() {
  if (!scrollFrame) scrollFrame = requestAnimationFrame(drawExperience);
}
function updateMotion() {
  document.documentElement.classList.toggle('immersive', !reduced);
  scheduleExperience();
}
addEventListener('scroll', scheduleExperience, {passive:true});
addEventListener('resize', scheduleExperience);
addEventListener('pageshow', scheduleExperience);
new ResizeObserver(scheduleExperience).observe(document.body);
motionPreference.addEventListener('change', updateMotion);
updateMotion();

const stages=[
  {date:'OCTOBER 22, 2026',title:'Every product starts somewhere.',copy:'The original MUN Helper: motions, conferences, and notes in one simple workspace.',url:'MUN Helper / the beginning',file:'early.html'},
  {date:'CURRENT VERSION',title:'Same idea. A whole new experience.',copy:'MUNLY today: a more considered workspace for research, documents, and conference preparation.',url:'MUNLY / today',file:'current.html?v=screenshot-1'}
];
let active=0,progress=0;
const vp=$('#viewport'),handle=$('#comparison-handle');
const playComparison = $('#play-comparison');
let replayFrame = 0;
let pausedAt = 0;
let captionState = '';
const inspectButton = $('#inspect-comparison');
const comparisonLabel = vp.getAttribute('aria-label');
let inspecting = false;
let lensX = .5;
let lensY = .5;

function aimLens(x, y) {
  lensX = Math.max(0, Math.min(1, x));
  lensY = Math.max(0, Math.min(1, y));
  vp.style.setProperty('--lens-x', `${lensX * 100}%`);
  vp.style.setProperty('--lens-y', `${lensY * 100}%`);
}
function aimAtPointer(event) {
  const rect = vp.getBoundingClientRect();
  aimLens((event.clientX - rect.left) / rect.width, (event.clientY - rect.top) / rect.height);
}
function inspectDetails(on) {
  inspecting = on;
  inspectButton.setAttribute('aria-pressed', String(on));
  vp.classList.toggle('inspecting', on);
  handle.hidden = on;
  inspectButton.textContent = on ? 'Exit zoom' : 'Inspect details';
  vp.setAttribute('aria-label', on ? 'Magnified dashboards. Point, tap, or use arrow keys to pan. Press Escape to exit zoom.' : comparisonLabel);
  if (on) {
    stopPlayback();
    stopComparison();
    aimLens(.5, .5);
    vp.focus({preventScroll: true});
  }
}
inspectButton.addEventListener('click', () => inspectDetails(!inspecting));


function stopPlayback(remember = false) {
  if (replayFrame) cancelAnimationFrame(replayFrame);
  replayFrame = 0;
  if (!remember) pausedAt = 0;
  vp.classList.remove('playing', 'is-comparing');
  playComparison.textContent = reduced ? 'Switch version' : pausedAt ? 'Resume comparison' : 'Play comparison';
}

playComparison.addEventListener('click', () => {
  if (inspecting) inspectDetails(false);
  if (reduced) { setStage(1 - active); return; }
  if (replayFrame) { stopPlayback(true); return; }
  cancelComparisonGlide();
  const duration = 3200;
  const start = performance.now() - pausedAt;
  function tick(time) {
    pausedAt = Math.max(0, time - start);
    const t = Math.min(1, pausedAt / duration);
    setProgress(t * t * (3 - 2 * t), true);
    if (t < 1) replayFrame = requestAnimationFrame(tick);
    else stopPlayback();
  }
  playComparison.textContent = 'Pause comparison';
  vp.classList.add('playing');
  tick(performance.now());
});
stopPlayback();
motionPreference.addEventListener('change', () => stopPlayback());
document.addEventListener('visibilitychange', () => { if (document.hidden && replayFrame) stopPlayback(true); });
function setProgress(value,immediate=false){
  progress=Math.max(0,Math.min(1,value));active=progress>=.5?1:0;
  const tilt=4*Math.sin(Math.PI*progress);
  const skew=-Math.atan((tilt/100)*2*vp.clientWidth/Math.max(1,vp.clientHeight||vp.clientWidth*.625))*180/Math.PI;
  vp.classList.toggle('is-comparing',immediate);
  vp.style.setProperty('--split',`${progress*100}%`);
  vp.style.setProperty('--edge-top',`${progress*100+tilt}%`);
  vp.style.setProperty('--edge-bottom',`${progress*100-tilt}%`);
  vp.style.setProperty('--divider-skew',`${skew}deg`);
  const mixed=progress>.001&&progress<.999;
  vp.classList.toggle('show-divider',mixed);
  const description=`${Math.round(progress*100)}% current dashboard revealed`;
  handle.setAttribute('aria-valuenow',String(Math.round(progress*100)));handle.setAttribute('aria-valuetext',description);
  $('.steps').style.setProperty('--selected',active);$('.steps').classList.toggle('mixed',mixed);
  $$('[data-step]').forEach((b,i)=>{b.setAttribute('aria-selected',String(!mixed&&i===active));b.tabIndex=i===active?0:-1});
  $$('.slide').forEach((slide,i)=>slide.setAttribute('aria-hidden',String(i===0?progress===1:progress===0)));
  const stage=stages[active];
  const nextCaption = mixed ? 'mixed' : stage.title;
  if (captionState !== nextCaption) {
    captionState = nextCaption;
    $('#stage-title').textContent=mixed?'One idea. See how it evolved.':stage.title;
  $('#stage-copy').textContent=mixed?'Drag to compare where MUNLY started with where it is today.':stage.copy;
  }
  $('#modal-prev').disabled=progress===0;
  $('#modal-next').disabled=progress===1;
  $('#modal-count').textContent=`0${active+1} / 02`;
}
function setStage(n){
  stopPlayback();
  cancelComparisonGlide();
  setProgress(Math.max(0,Math.min(1,n)));
  if($('#lightbox').open){$('#large-preview').src=stages[active].file;$('#modal-label').textContent=`0${active+1} / ${stages[active].url}`}
}
function navigateKey(e){
  if (inspecting) {
    if (e.key === 'Escape') {
      inspectDetails(false);
      inspectButton.focus({preventScroll: true});
      return;
    }
    const shifts = {ArrowLeft: [-.06, 0], ArrowRight: [.06, 0], ArrowUp: [0, -.06], ArrowDown: [0, .06]};
    const shift = shifts[e.key];
    if (shift) {
      e.preventDefault();
      aimLens(lensX + shift[0], lensY + shift[1]);
    }
    return;
  }
  if(!['ArrowRight','ArrowLeft','Home','End'].includes(e.key))return;
  e.preventDefault();
  stopPlayback();
  cancelComparisonGlide();
  setProgress(e.key==='Home'?0:e.key==='End'?1:progress+(e.key==='ArrowRight'?.05:-.05),true);
}
$$('[data-step]').forEach(b=>{b.addEventListener('click',()=>setStage(+b.dataset.step));b.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft','Home','End'].includes(e.key)){e.preventDefault();setStage(e.key==='Home'||e.key==='ArrowLeft'?0:1);$$('[data-step]')[active].focus()}})});
$('#modal-prev').onclick=()=>setStage(0);
$('#modal-next').onclick=()=>setStage(1);
vp.addEventListener('keydown',navigateKey);
let dragging=false,dragPointer=null,comparisonFrame=0;
let comparisonSamples=[],lastComparisonMove=0,comparisonTravel=0;
function cancelComparisonGlide(){
  if(comparisonFrame)cancelAnimationFrame(comparisonFrame);
  comparisonFrame=0;
}
function revealAt(e,record=false){
  const rect=vp.getBoundingClientRect(),previous=progress;
  setProgress((e.clientX-rect.left)/rect.width,true);
  if(record){
    const now=e.timeStamp;
    const movement=Math.abs(progress-previous);
    if(movement>.00001){lastComparisonMove=now;comparisonTravel+=movement}
    comparisonSamples.push({time:now,position:progress});
    while(comparisonSamples.length>2&&comparisonSamples[1].time<now-85)comparisonSamples.shift();
  }
}
function glideComparison(releasedAt){
  cancelComparisonGlide();
  if(reduced||comparisonTravel<.004||releasedAt-lastComparisonMove>90||comparisonSamples.length<2)return;
  const first=comparisonSamples[0],last=comparisonSamples[comparisonSamples.length-1];
  const elapsed=last.time-first.time;
  if(elapsed<4)return;
  const velocity=(last.position-first.position)/elapsed;
  if(Math.abs(velocity)<.00004)return;
  const origin=progress;
  const distance=Math.max(-.12,Math.min(.12,velocity*280/3));
  const target=Math.max(0,Math.min(1,origin+distance));
  if(Math.abs(target-origin)<.0001)return;
  const duration=Math.min(280,3*Math.abs(target-origin)/Math.abs(velocity));
  let started=null;
  function step(time){
    if(started===null)started=time;
    const t=Math.min(1,(time-started)/duration);
    setProgress(origin+(target-origin)*(1-Math.pow(1-t,3)),true);
    if(t<1){comparisonFrame=requestAnimationFrame(step)}
    else{comparisonFrame=0;vp.classList.remove('is-comparing')}
  }
  comparisonFrame=requestAnimationFrame(step);
}
vp.addEventListener('pointerdown',e=>{
  if(e.button!==0)return;
  if (inspecting) { aimAtPointer(e); return; }
  stopPlayback();
  cancelComparisonGlide();dragging=true;dragPointer=e.pointerId;
  comparisonSamples=[];comparisonTravel=0;lastComparisonMove=e.timeStamp;
  vp.setPointerCapture(e.pointerId);revealAt(e);
  comparisonSamples.push({time:e.timeStamp,position:progress});
});
vp.addEventListener('pointermove', event => {
  if (inspecting) aimAtPointer(event);
  else if (dragging && event.pointerId === dragPointer) revealAt(event, true);
});
function stopComparison(){dragging=false;cancelComparisonGlide();vp.classList.remove('is-comparing')}
vp.addEventListener('pointerup',e=>{
  if(dragging&&e.pointerId===dragPointer){
    revealAt(e,true);dragging=false;vp.classList.remove('is-comparing');glideComparison(e.timeStamp);
  }
});
vp.addEventListener('pointercancel',stopComparison);
vp.addEventListener('lostpointercapture',()=>{if(dragging)stopComparison()});
addEventListener('blur',stopComparison);
new ResizeObserver(()=>setProgress(progress)).observe(vp);
setProgress(.5);
const dialog=$('#lightbox');
$('#expand').onclick=()=>{stopPlayback();stopComparison();dialog.showModal();document.body.classList.add('modal-open');$('#large-preview').src=stages[active].file;$('#modal-label').textContent=`0${active+1} / ${stages[active].url}`};
$('#close-modal').onclick=()=>dialog.close();
dialog.addEventListener('close',()=>{document.body.classList.remove('modal-open');$('#large-preview').removeAttribute('src');$('#expand').focus()});
dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close()}});
dialog.addEventListener('keydown',e=>{if(['ArrowRight','ArrowLeft'].includes(e.key)){e.preventDefault();setStage(e.key==='ArrowRight'?1:0)}});
