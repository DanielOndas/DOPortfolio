'use strict';

(() => {
  const stage = document.querySelector('[data-core-stage]');
  if (!stage || !window.CoreMath) return;
  const device = stage.querySelector('[data-core-device]');
  const display = device.querySelector('[data-core-display]');
  const announcement = device.querySelector('[data-core-announcement]');
  const M = window.CoreMath;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const storageKey = 'portfolio.core.explorer.v2';
  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const $ = selector => display.querySelector(selector);
  const defaults = {theme:'olive', angle:'deg', sound:false, brightness:100, history:[], best:0, notes:[{id:'welcome', title:'A note to the curious', body:'A calculator can be a small place for big ideas.\n\nTry plotting sin(x), solve a triangle, or just take a break.\n\nThis notebook stays in your browser. Make it yours.\n\n— Daniel'}]};
  let saved;
  try { saved = JSON.parse(localStorage.getItem(storageKey)); } catch {}
  const prefs = {...defaults};
  if (saved && typeof saved === 'object') {
    if (['olive','paper','night'].includes(saved.theme)) prefs.theme = saved.theme;
    if (['deg','rad'].includes(saved.angle)) prefs.angle = saved.angle;
    prefs.sound = saved.sound === true;
    if (Number.isFinite(saved.brightness)) prefs.brightness = Math.max(65,Math.min(100,saved.brightness));
    if (Array.isArray(saved.history)) prefs.history = saved.history.filter(h => typeof h.expression === 'string' && h.expression.length <= 240 && Number.isFinite(h.answer)).slice(0,20);
    if (Array.isArray(saved.notes)) prefs.notes = saved.notes.filter(n => n && typeof n.id === 'string' && typeof n.title === 'string' && typeof n.body === 'string').slice(0,10).map(n=>({id:n.id.slice(0,80),title:n.title.slice(0,50),body:n.body.slice(0,6000)}));
    if (!prefs.notes.length) prefs.notes = defaults.notes;
    if (Number.isInteger(saved.best) && saved.best >= 0) prefs.best = saved.best;
  }
  let storageOK = true, power = 'off', app = 'home', bootTimer, bootVersion = 0;
  let expression = '', answer = 0, committed = false, calcError = '';
  let selectedNote = prefs.notes[0].id, noteTimer;
  let unknown = 'c', triangleValues = {a:3,b:4,c:5};
  let graph = {source:'sin(x)',fn:null,cx:0,cy:0,unit:30,trace:null};
  let graphFrame = 0, graphReveal = 1, graphDrag = null;
  let audioContext;
  let snake = {body:[],dir:[1,0],next:[1,0],food:[12,7],score:0,state:'ready',timer:0,turned:false};
  const apps = [
    {id:'calculator',name:'Calculate',icon:'<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 11h1m3 0h1m3 0h0M8 15h1m3 0h1m3 0h0M8 18h1m3 0h1m3 0h0"/>'},
    {id:'graph',name:'Graph',icon:'<path d="M4 3v17h17M3 16c5 0 4-11 9-11s4 11 9 11"/>'},
    {id:'triangle',name:'Triangle',icon:'<path d="M4 3v17h17ZM4 15h5v5"/>'},
    {id:'notes',name:'Notes',icon:'<path d="M6 3h10l3 3v15H6ZM9 9h7M9 13h7M9 17h4"/>'},
    {id:'snake',name:'Snake',icon:'<path d="M4 6h13a3 3 0 0 1 0 6H7a3 3 0 0 0 0 6h13M4 4v4M20 16v4"/>'},
    {id:'settings',name:'Settings',icon:'<path d="M3 6h18M3 12h18M3 18h18"/><rect x="7" y="4" width="3" height="4" rx="1"/><rect x="14" y="10" width="3" height="4" rx="1"/><rect x="8" y="16" width="3" height="4" rx="1"/>'}
  ];
  const icon = path => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+path+'</svg>';
  function save() {
    try { localStorage.setItem(storageKey,JSON.stringify(prefs)); storageOK=true; } catch { storageOK=false; }
    return storageOK;
  }
  function say(text) { announcement.textContent = text; }
  function applyPrefs() {
    device.dataset.theme=prefs.theme;
    display.style.filter='brightness('+prefs.brightness/100+')';
    device.querySelector('[data-angle-key]').textContent=prefs.angle.toUpperCase();
  }
  applyPrefs();
  function clickSound() {
    if (!prefs.sound) return;
    try {
      audioContext ||= new (window.AudioContext || window.webkitAudioContext)();
      if (audioContext.state==='suspended') audioContext.resume().catch(()=>{});
      const oscillator=audioContext.createOscillator(), gain=audioContext.createGain(), now=audioContext.currentTime;
      oscillator.type='sine'; oscillator.frequency.setValueAtTime(630,now); oscillator.frequency.exponentialRampToValueAtTime(260,now+.035);
      gain.gain.setValueAtTime(.025,now);gain.gain.exponentialRampToValueAtTime(.001,now+.045);
      oscillator.connect(gain);gain.connect(audioContext.destination);oscillator.start(now);oscillator.stop(now+.05);
    } catch {}
  }
  function stopActivity() { cancelAnimationFrame(graphFrame); graphFrame=0; if(snake.state==='running') pauseSnake(); }
  function powerOff() {
    ++bootVersion; clearTimeout(bootTimer); stopActivity(); power='off';
    device.querySelector('[data-power-key]').setAttribute('aria-pressed','false');
    display.innerHTML='<div class="core-off"><div class="core-off-symbol" aria-hidden="true">⌘</div><p>A little curiosity<br>goes a long way.</p><button type="button" data-action="power">Power on <span>↗</span></button></div>';
    say('CORE OS powered off.');
  }
  function boot(target='home') {
    if (power==='on') { openApp(target); return; }
    if (power==='booting') return;
    power='booting'; const version=++bootVersion;
    device.querySelector('[data-power-key]').setAttribute('aria-pressed','true');
    display.innerHTML='<div class="core-booting"><strong>CORE OS</strong><p>Room for a little curiosity.</p><div class="core-boot-track"><i></i></div></div>';
    bootTimer=setTimeout(()=>{if(version!==bootVersion)return;power='on';openApp(target);say('CORE OS ready.');},reduced.matches?0:850);
  }
  function clock() { return new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',hour12:false}); }
  function frame(content, hint) {
    const title=app==='home'?'CORE OS':(apps.find(a=>a.id===app)?.name || app).toUpperCase();
    display.innerHTML='<div class="core-status"><span>'+title+'</span><span class="core-status-right"><span data-mode-label>'+prefs.angle.toUpperCase()+'</span><time>'+clock()+'</time></span></div><div class="core-page">'+content+'</div><div class="core-softbar"><button type="button" data-action="home">⌂ Home</button><span>'+hint+'</span></div>';
  }
  function openApp(next, focus=true) {
    if (power!=='on') {boot(next);return;}
    if (next!=='home' && !apps.some(a=>a.id===next)) return;
    stopActivity(); app=next; graphDrag=null;
    const renderers={home:renderHome,calculator:renderCalculator,graph:renderGraph,triangle:renderTriangle,notes:renderNotes,snake:renderSnake,settings:renderSettings};
    renderers[app]();
    if(focus) device.focus({preventScroll:true});
    say((next==='home'?'Home':apps.find(a=>a.id===next).name)+' opened.');
  }
  function renderHome() {
    frame('<h5 class="core-home-greeting">What’s on your mind?</h5><p class="core-home-caption">Six little tools. Plenty of possibilities.</p><div class="core-apps">'+apps.map(a=>'<button type="button" class="core-app" data-open="'+a.id+'"><span class="core-app-icon">'+icon(a.icon)+'</span><span>'+a.name+'</span></button>').join('')+'</div><p class="core-home-tip"><span>↳</span> Arrow keys to explore. Enter to open.</p>','EXPLORER  /  01');
  }
  function renderCalculator() {
    frame('<div class="core-title-row"><h5>Work it out.</h5><button type="button" class="core-chip" data-action="angle">'+prefs.angle.toUpperCase()+'</button></div><label class="core-expression-label" for="core-expression">EXPRESSION</label><input id="core-expression" class="core-expression" autocomplete="off" spellcheck="false" maxlength="240" placeholder="Try sin(45) × 8" value="'+esc(expression)+'"><output class="core-answer" aria-live="polite"></output><p class="core-calc-feedback"></p><div class="core-history"></div>','Enter = calculate · Esc = home');
    $('#core-expression').addEventListener('input',e=>{expression=e.target.value;committed=false;calcError='';previewCalc();});
    previewCalc();renderHistory();
  }
  function previewCalc() {
    const out=$('.core-answer'); if(!out)return;
    out.classList.toggle('is-preview',!committed);
    if(calcError) {out.textContent='Check input';$('.core-calc-feedback').textContent=calcError;return;}
    try {const result=committed?answer:M.evaluate(expression||'0',{angle:prefs.angle,ans:answer});out.textContent=M.format(result);$('.core-calc-feedback').textContent=committed?'Result saved to history':expression?'Live result · press Enter to keep':'Use the keypad or type an expression';}
    catch {out.textContent='…';$('.core-calc-feedback').textContent='Keep going…';}
  }
  function calculate() {
    try {
      const result=M.evaluate(expression||'0',{angle:prefs.angle,ans:answer});
      prefs.history.unshift({expression:expression||'0',answer:result});prefs.history=prefs.history.slice(0,20);save();
      answer=result;committed=true;calcError='';previewCalc();renderHistory();say('Result: '+M.format(result));
    } catch(error) {calcError=error.message;previewCalc();say(calcError);}
  }
  function renderHistory() {
    const container=$('.core-history');if(!container)return;
    container.innerHTML='<div class="core-history-heading"><span>HISTORY</span>'+(prefs.history.length?'<button type="button" data-action="clear-history">Clear</button>':'')+'</div>'+prefs.history.slice(0,8).map((h,i)=>'<button type="button" class="core-history-item" data-history="'+i+'" aria-label="Reuse '+esc(h.expression)+'"><span>'+esc(h.expression)+'</span><strong>'+esc(M.format(h.answer))+'</strong></button>').join('')+(!prefs.history.length?'<p class="core-muted">Your next bright idea starts here.</p>':'');
  }
  function insertKey(key) {
    if(power!=='on')return;
    if(app==='graph') {
      if(key==='='){plotEquation();return;}
      const input=$('#core-equation');editInput(input,key);graph.source=input.value;return;
    }
    if(app==='triangle') {
      const input=display.contains(document.activeElement)&&document.activeElement.matches('[data-triangle-input]')?document.activeElement:$('.core-triangle-fields input:not(:disabled)');
      if(/^[0-9.]$/.test(key)||key==='DEL'||key==='AC'){editInput(input,key);updateTriangle();}return;
    }
    if(app!=='calculator')openApp('calculator');
    if(key==='='){calculate();return;}
    const input=$('#core-expression');
    if(committed && key!=='DEL') {expression=/^[+*/^%-]$/.test(key)?M.format(answer):'';input.value=expression;}
    editInput(input,key);expression=input.value;committed=false;calcError='';previewCalc();
  }
  function editInput(input,key) {
    if(!input)return;
    let start=input.selectionStart??input.value.length, end=input.selectionEnd??start;
    if(key==='AC'){input.value='';start=0;}
    else if(key==='DEL'){if(start===end)start=Math.max(0,start-1);input.value=input.value.slice(0,start)+input.value.slice(end);}
    else {if(input.value.length+key.length-(end-start)>240)return;input.value=input.value.slice(0,start)+key+input.value.slice(end);start+=key.length;}
    input.setSelectionRange?.(start,start);
    // Hardware keys do not open the mobile software keyboard.
  }
  function renderGraph() {
    frame('<div class="core-graph-form"><label for="core-equation">y =<input id="core-equation" value="'+esc(graph.source)+'" maxlength="240" spellcheck="false" autocomplete="off"></label><button type="button" class="core-primary" data-action="plot">Plot</button></div><div class="core-graph-presets"><button type="button" data-equation="sin(x)">sin(x)</button><button type="button" data-equation="x^2">x²</button><button type="button" data-equation="1/x">1/x</button><button type="button" data-equation="2x+1">2x+1</button></div><div class="core-plot-wrap"><canvas class="core-plot" tabindex="0" aria-label="Function graph. Drag to pan, use arrow keys to pan, plus and minus to zoom."></canvas><div class="core-plot-tools"><button type="button" data-zoom="1.3" aria-label="Zoom in">+</button><button type="button" data-zoom="0.77" aria-label="Zoom out">−</button><button type="button" data-action="graph-reset" aria-label="Reset graph view">↺</button></div></div><div class="core-graph-readout"><span data-graph-trace>Drag to pan · hover to trace</span><span>RAD</span></div><p class="core-muted" data-graph-error role="status"></p>','Functions plotted in radians');
    const canvas=$('.core-plot');
    canvas.addEventListener('pointerdown',e=>{if(e.button!==0)return;canvas.focus({preventScroll:true});graphDrag={id:e.pointerId,x:e.clientX,y:e.clientY,cx:graph.cx,cy:graph.cy};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{
      const rect=canvas.getBoundingClientRect();
      if(graphDrag?.id===e.pointerId){graph.cx=graphDrag.cx-(e.clientX-graphDrag.x)/graph.unit;graph.cy=graphDrag.cy+(e.clientY-graphDrag.y)/graph.unit;}
      graph.trace=(e.clientX-rect.left-rect.width/2)/graph.unit+graph.cx;drawGraph();
    });
    const release=e=>{if(graphDrag?.id===e.pointerId)graphDrag=null;};
    ['pointerup','pointercancel','lostpointercapture'].forEach(t=>canvas.addEventListener(t,release));
    canvas.addEventListener('pointerleave',()=>{if(!graphDrag){graph.trace=null;drawGraph();}});
    canvas.addEventListener('keydown',e=>{if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','-','='].includes(e.key)){e.preventDefault();e.stopPropagation();if(e.key.includes('Arrow')){graph.cx+=(e.key==='ArrowRight'?1:e.key==='ArrowLeft'?-1:0)*30/graph.unit;graph.cy+=(e.key==='ArrowUp'?1:e.key==='ArrowDown'?-1:0)*30/graph.unit;}else zoomGraph(e.key==='-'?.8:1.25);drawGraph();}});
    plotEquation();
  }
  function plotEquation() {
    graph.source=$('#core-equation').value;
    try {graph.fn=M.compile(graph.source,{variable:true,angle:'rad'});$('[data-graph-error]').textContent='';}
    catch(error){graph.fn=null;$('[data-graph-error]').textContent=error.message;}
    graph.trace=null;cancelAnimationFrame(graphFrame);
    const start=performance.now();
    const animate=now=>{graphReveal=reduced.matches?1:Math.min(1,(now-start)/420);drawGraph();if(graphReveal<1&&app==='graph')graphFrame=requestAnimationFrame(animate);};
    graphFrame=requestAnimationFrame(animate);
  }
  function canvasContext(canvas) {
    if(!canvas)return null;
    const w=canvas.clientWidth,h=canvas.clientHeight;if(!w||!h)return null;
    const dpr=Math.min(devicePixelRatio||1,2);
    if(canvas.width!==Math.round(w*dpr)||canvas.height!==Math.round(h*dpr)){canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);}
    const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);return {ctx,w,h};
  }
  function colors() {const s=getComputedStyle(device);return Object.fromEntries(['bg','panel','ink','muted','border','accent','inverse'].map(k=>[k,s.getPropertyValue('--os-'+k).trim()]));}
  function drawGraph() {
    if(app!=='graph'||power!=='on')return;
    const canvas=$('.core-plot'),info=canvasContext(canvas);if(!info)return;
    const {ctx,w,h}=info,c=colors(),u=graph.unit,ox=w/2-graph.cx*u,oy=h/2+graph.cy*u;
    ctx.fillStyle=c.bg;ctx.fillRect(0,0,w,h);
    const raw=45/u,base=10**Math.floor(Math.log10(raw)),step=[1,2,5,10].find(n=>n*base>=raw)*base;
    ctx.font='9px monospace';ctx.textAlign='center';ctx.lineWidth=.6;
    for(let x=Math.ceil((graph.cx-w/2/u)/step)*step;x<=graph.cx+w/2/u;x+=step){const px=ox+x*u;ctx.strokeStyle=c.border;ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();if(Math.abs(x)>step*.01){ctx.fillStyle=c.muted;ctx.fillText(M.format(x),px,Math.min(h-4,Math.max(12,oy+12)));}}
    for(let y=Math.ceil((graph.cy-h/2/u)/step)*step;y<=graph.cy+h/2/u;y+=step){const py=oy-y*u;ctx.strokeStyle=c.border;ctx.beginPath();ctx.moveTo(0,py);ctx.lineTo(w,py);ctx.stroke();if(Math.abs(y)>step*.01){ctx.fillStyle=c.muted;ctx.fillText(M.format(y),Math.min(w-18,Math.max(17,ox+16)),py-3);}}
    ctx.strokeStyle=c.muted;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(ox,0);ctx.lineTo(ox,h);ctx.moveTo(0,oy);ctx.lineTo(w,oy);ctx.stroke();
    if(!graph.fn)return;
    ctx.strokeStyle=c.accent;ctx.lineWidth=2.3;ctx.lineJoin='round';ctx.beginPath();let lastY=null;
    for(let px=0;px<=w*graphReveal;px++){const x=(px-ox)/u,y=graph.fn(x),py=oy-y*u;
      if(!Number.isFinite(py)||Math.abs(py)>h*10){lastY=null;continue;}
      const mid=graph.fn(x-.5/u),midY=oy-mid*u;
      if(lastY===null||Math.abs(py-lastY)>h||!Number.isFinite(midY)||Math.abs(midY-(py+lastY)/2)>h/3)ctx.moveTo(px,py);else ctx.lineTo(px,py);lastY=py;
    }ctx.stroke();
    if(graph.trace!==null){const x=graph.trace,y=graph.fn(x),px=ox+x*u,py=oy-y*u;
      $('[data-graph-trace]').textContent='x '+M.format(x)+' · y '+(Number.isFinite(y)?M.format(y):'undefined');
      if(Number.isFinite(py)){ctx.strokeStyle=c.muted;ctx.setLineDash([3,4]);ctx.beginPath();ctx.moveTo(px,0);ctx.lineTo(px,h);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc(px,py,4,0,Math.PI*2);ctx.fill();}
    }else $('[data-graph-trace]').textContent='Drag to pan · hover to trace';
    canvas.setAttribute('aria-label','Graph of y = '+graph.source+'. Drag or use arrow keys to pan. Plus and minus zoom.');
  }
  function zoomGraph(factor){graph.unit=Math.min(180,Math.max(8,graph.unit*factor));graphReveal=1;drawGraph();}
  function renderTriangle() {
    frame('<div class="core-title-row"><h5>Find the missing piece.</h5></div><div class="core-segmented" aria-label="Side to solve">'+['a','b','c'].map(s=>'<button type="button" data-unknown="'+s+'" aria-pressed="'+(s===unknown)+'">Solve '+s.toUpperCase()+'</button>').join('')+'</div><div class="core-triangle-layout"><svg class="core-triangle-svg" viewBox="0 0 150 132" role="img" aria-label="Right triangle"><path data-tri-fill fill="var(--os-panel)"/><path class="core-triangle-side" data-tri-side="a"/><path class="core-triangle-side" data-tri-side="b"/><path class="core-triangle-side" data-tri-side="c"/><path data-tri-angle fill="none" stroke="var(--os-muted)"/><text data-tri-label="a">A</text><text data-tri-label="b">B</text><text data-tri-label="c">C</text></svg><div class="core-triangle-fields">'+['a','b','c'].map(s=>'<label>'+s.toUpperCase()+'<input type="text" inputmode="decimal" aria-label="Side '+s.toUpperCase()+'" data-triangle-input="'+s+'" value="'+(s===unknown?'?':M.format(triangleValues[s]))+'" '+(s===unknown?'disabled':'')+' maxlength="12"></label>').join('')+'</div></div><div class="core-triangle-result"><span class="core-muted">MISSING SIDE</span><strong data-triangle-result></strong></div><p class="core-triangle-formula" data-triangle-formula></p><p class="core-muted" data-triangle-error role="status"></p>','A & B = legs · C = hypotenuse');
    display.querySelectorAll('[data-triangle-input]').forEach(el=>el.addEventListener('input',updateTriangle));updateTriangle();
  }
  function updateTriangle() {
    const input={...triangleValues};display.querySelectorAll('[data-triangle-input]:not(:disabled)').forEach(el=>{input[el.dataset.triangleInput]=Number(el.value);});
    let v;
    try {v=M.triangle(unknown,input);triangleValues=v;$('[data-triangle-result]').textContent=unknown.toUpperCase()+' = '+M.format(v[unknown]);$('[data-triangle-error]').textContent='';}
    catch(error){$('[data-triangle-result]').textContent='—';$('[data-triangle-error]').textContent=error.message;v=triangleValues;}
    const formula=unknown==='c'?'C = √(A² + B²)':unknown==='a'?'A = √(C² − B²)':'B = √(C² − A²)';
    $('[data-triangle-formula]').textContent=formula;
    const unit=Math.min(89/v.a,100/v.b),width=v.b*unit,height=v.a*unit,left=(150-width)/2,base=(132+height)/2-8,top=base-height,right=left+width;
    $('[data-tri-fill]').setAttribute('d',`M${left} ${top}V${base}H${right}Z`);
    const paths={a:`M${left} ${top}V${base}`,b:`M${left} ${base}H${right}`,c:`M${left} ${top}L${right} ${base}`};
    for(const s of ['a','b','c']){const path=$('[data-tri-side="'+s+'"]');path.setAttribute('d',paths[s]);path.classList.toggle('is-unknown',s===unknown);}
    const corner=Math.min(9,width/3,height/3);$('[data-tri-angle]').setAttribute('d',`M${left} ${base-corner}h${corner}v${corner}`);
    const labels={a:[left-11,(base+top)/2],b:[left+width/2,base+15],c:[left+width/2+12,(top+base)/2-7]};
    for(const [s,[x,y]] of Object.entries(labels)){const label=$('[data-tri-label="'+s+'"]');label.setAttribute('x',x);label.setAttribute('y',y);}
    $('.core-triangle-svg').setAttribute('aria-label',`Right triangle. A ${M.format(v.a)}, B ${M.format(v.b)}, C ${M.format(v.c)}. Solving ${unknown.toUpperCase()}.`);
  }
  function renderNotes() {
    const note=prefs.notes.find(n=>n.id===selectedNote)||prefs.notes[0];selectedNote=note.id;
    frame('<div class="core-notes"><div class="core-title-row"><h5>A place for thoughts.</h5><button type="button" class="core-small-button" data-action="new-note" '+(prefs.notes.length>=10?'disabled':'')+'>+ New</button></div><select aria-label="Choose a note" data-note-select>'+prefs.notes.map(n=>'<option value="'+esc(n.id)+'" '+(n.id===note.id?'selected':'')+'>'+esc(n.title||'Untitled')+'</option>').join('')+'</select><input class="core-note-title" aria-label="Note title" maxlength="50" value="'+esc(note.title)+'"><textarea aria-label="Note text" maxlength="6000" spellcheck="false">'+esc(note.body)+'</textarea><div class="core-note-bottom"><span data-note-status>'+(storageOK?'Saved on this device':'Saved for this visit')+'</span><button type="button" data-action="delete-note">Delete note</button></div></div>','Local notebook · up to 10 notes');
    $('[data-note-select]').addEventListener('change',e=>{selectedNote=e.target.value;renderNotes();});
    const change=()=>{note.title=$('.core-note-title').value;note.body=$('textarea').value;save();$('[data-note-status]').textContent=storageOK?'Saved on this device':'Storage unavailable · this visit only';const option=$('[data-note-select]').selectedOptions[0];option.textContent=note.title||'Untitled';};
    $('.core-note-title').addEventListener('input',change);$('textarea').addEventListener('input',change);
  }
  function renderSettings() {
    frame('<div class="core-title-row"><h5>Make yourself at home.</h5></div><div class="core-settings-row"><span>Display theme</span><div class="core-setting-themes">'+['olive','paper','night'].map(t=>'<button type="button" data-theme-choice="'+t+'" aria-label="'+t+' theme" aria-pressed="'+(prefs.theme===t)+'"></button>').join('')+'</div></div><div class="core-settings-row"><span>Angle mode</span><button type="button" class="core-chip" data-action="angle">'+prefs.angle.toUpperCase()+'</button></div><label class="core-settings-row">Brightness<input type="range" min="65" max="100" value="'+prefs.brightness+'" aria-label="Display brightness" data-brightness></label><div class="core-settings-row"><span>Key sounds</span><button type="button" class="core-chip" data-action="sound" aria-pressed="'+prefs.sound+'">'+(prefs.sound?'On':'Off')+'</button></div><p class="core-settings-about">CORE OS · Explorer edition<br>A browser simulator by Daniel Ondáš.<br>Your notes and preferences stay on this device.</p>','Built for the curious.');
    $('[data-brightness]').addEventListener('input',e=>{prefs.brightness=Number(e.target.value);applyPrefs();save();});
  }
  function resetSnake() {
    clearTimeout(snake.timer);snake={body:[[5,6],[4,6],[3,6]],dir:[1,0],next:[1,0],food:[12,6],score:0,state:'ready',timer:0,turned:false};
  }
  function renderSnake() {
    if(!snake.body.length)resetSnake();
    frame('<div class="core-snake-top"><span>SNAKE <b data-snake-score>'+snake.score+'</b></span><span>BEST <b data-snake-best>'+prefs.best+'</b></span></div><canvas class="core-snake-board" width="320" height="180" tabindex="0" aria-label="Snake game. Use arrow keys. Space pauses."></canvas><div class="core-snake-bottom"><button type="button" class="core-primary" data-action="snake-start">'+(snake.state==='paused'?'Resume':'Start game')+'</button><div class="core-dpad" aria-label="Snake controls"><button type="button" data-direction="up" aria-label="Up">↑</button><button type="button" data-direction="left" aria-label="Left">←</button><button type="button" data-direction="down" aria-label="Down">↓</button><button type="button" data-direction="right" aria-label="Right">→</button></div></div><p class="core-muted" data-snake-message>Arrow keys or the pad. Space to pause.</p>','A little break goes a long way.');
    drawSnake();
  }
  function direction(name) {
    const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};const d=dirs[name];if(!d||snake.turned||snake.state!=='running')return;
    if(d[0]===-snake.dir[0]&&d[1]===-snake.dir[1])return;snake.next=d;snake.turned=true;
  }
  function startSnake() {
    if(snake.state==='running'){pauseSnake();return;}
    if(['over','ready','won'].includes(snake.state))resetSnake();
    snake.state='running';$('[data-action="snake-start"]').textContent='Pause';$('[data-snake-message]').textContent='Arrow keys or the pad. Space to pause.';
    $('.core-snake-board').focus({preventScroll:true});tickSnake();
  }
  function pauseSnake() {
    clearTimeout(snake.timer);if(snake.state==='running')snake.state='paused';
    if(app==='snake'&&$('[data-action="snake-start"]')){$('[data-action="snake-start"]').textContent='Resume';drawSnake();}
  }
  function tickSnake() {
    if(snake.state!=='running'||app!=='snake'||power!=='on'||document.hidden)return;
    snake.dir=snake.next;snake.turned=false;
    const head=[snake.body[0][0]+snake.dir[0],snake.body[0][1]+snake.dir[1]],eating=head[0]===snake.food[0]&&head[1]===snake.food[1];
    const body=eating?snake.body:snake.body.slice(0,-1);
    if(head[0]<0||head[0]>=20||head[1]<0||head[1]>=12||body.some(p=>p[0]===head[0]&&p[1]===head[1])){
      snake.state='over';$('[data-action="snake-start"]').textContent='Play again';say('Game over. Score '+snake.score);drawSnake();return;
    }
    snake.body.unshift(head);if(!eating)snake.body.pop();
    else {
      snake.score++;prefs.best=Math.max(prefs.best,snake.score);save();clickSound();
      const free=[];for(let y=0;y<12;y++)for(let x=0;x<20;x++)if(!snake.body.some(p=>p[0]===x&&p[1]===y))free.push([x,y]);
      if(!free.length){snake.state='won';$('[data-action="snake-start"]').textContent='Play again';drawSnake();return;}
      snake.food=free[Math.floor(Math.random()*free.length)];
    }
    $('[data-snake-score]').textContent=snake.score;$('[data-snake-best]').textContent=prefs.best;
    drawSnake();snake.timer=setTimeout(tickSnake,Math.max(75,160-snake.score*4));
  }
  function drawSnake() {
    if(app!=='snake'||power!=='on')return;const info=canvasContext($('.core-snake-board'));if(!info)return;
    const {ctx,w,h}=info,c=colors(),sx=w/20,sy=h/12;ctx.fillStyle=c.panel;ctx.fillRect(0,0,w,h);
    ctx.globalAlpha=.3;ctx.fillStyle=c.border;for(let x=0;x<20;x++)for(let y=0;y<12;y++)ctx.fillRect(x*sx+sx/2,y*sy+sy/2,1,1);ctx.globalAlpha=1;
    snake.body.forEach(([x,y],i)=>{ctx.fillStyle=i?c.accent:c.ink;ctx.fillRect(x*sx+1,y*sy+1,sx-2,sy-2);});
    ctx.fillStyle=c.accent;ctx.beginPath();ctx.arc((snake.food[0]+.5)*sx,(snake.food[1]+.5)*sy,Math.min(sx,sy)*.3,0,Math.PI*2);ctx.fill();
    if(snake.state!=='running'){
      ctx.fillStyle=c.bg;ctx.globalAlpha=.88;ctx.fillRect(0,0,w,h);ctx.globalAlpha=1;
      ctx.fillStyle=c.ink;ctx.textAlign='center';ctx.font='600 22px monospace';ctx.fillText({ready:'A little detour.',paused:'Take your time.',over:'One more try?',won:'You filled it!'}[snake.state],w/2,h/2-5);
      ctx.font='10px monospace';ctx.fillStyle=c.muted;ctx.fillText(snake.state==='over'?'Score '+snake.score+' · best '+prefs.best:'Find your rhythm. Follow the dots.',w/2,h/2+18);
    }
  }
  stage.addEventListener('pointerdown',e=>{if(e.target.closest('[data-key]'))e.preventDefault();});
  stage.addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b||!stage.contains(b))return;clickSound();
    if(b.dataset.coreLaunch){boot(b.dataset.coreLaunch);return;}
    if(b.dataset.open){openApp(b.dataset.open);return;}
    if(b.dataset.key){b.classList.add('is-pressed');setTimeout(()=>b.classList.remove('is-pressed'),110);insertKey(b.dataset.key);return;}
    if(b.dataset.equation){$('#core-equation').value=b.dataset.equation;plotEquation();return;}
    if(b.dataset.zoom){zoomGraph(Number(b.dataset.zoom));return;}
    if(b.dataset.unknown){unknown=b.dataset.unknown;renderTriangle();return;}
    if(b.dataset.themeChoice){prefs.theme=b.dataset.themeChoice;applyPrefs();save();renderSettings();return;}
    if(b.dataset.history!==undefined){expression=prefs.history[Number(b.dataset.history)].expression;committed=false;calcError='';$('#core-expression').value=expression;previewCalc();return;}
    if(b.dataset.direction){direction(b.dataset.direction);return;}
    switch(b.dataset.action){
      case 'power':power==='off'?boot():powerOff();break;
      case 'home':case 'back':boot('home');break;
      case 'angle':prefs.angle=prefs.angle==='deg'?'rad':'deg';applyPrefs();save();if(power==='on'){if(app==='calculator'){committed=false;calcError='';renderCalculator();}else if(app==='settings')renderSettings();else if($('[data-mode-label]'))$('[data-mode-label]').textContent=prefs.angle.toUpperCase();}break;
      case 'clear-history':prefs.history=[];save();renderHistory();break;
      case 'plot':plotEquation();break;
      case 'graph-reset':graph.cx=0;graph.cy=0;graph.unit=30;graph.trace=null;graphReveal=1;drawGraph();break;
      case 'sound':prefs.sound=!prefs.sound;save();renderSettings();break;
      case 'new-note':if(prefs.notes.length>=10)return;selectedNote='note-'+Date.now();prefs.notes.push({id:selectedNote,title:'Untitled',body:''});save();renderNotes();$('.core-note-title').focus();$('.core-note-title').select();break;
      case 'delete-note':if(!b.dataset.confirm){b.dataset.confirm='yes';b.textContent='Confirm delete?';clearTimeout(noteTimer);noteTimer=setTimeout(()=>{if(b.isConnected){delete b.dataset.confirm;b.textContent='Delete note';}},3000);return;}prefs.notes=prefs.notes.filter(n=>n.id!==selectedNote);if(!prefs.notes.length)prefs.notes=[{id:'note-'+Date.now(),title:'Untitled',body:''}];selectedNote=prefs.notes[0].id;save();renderNotes();break;
      case 'snake-start':startSnake();break;
    }
  });
  device.addEventListener('keydown',e=>{
    if(e.metaKey||e.ctrlKey||e.altKey||e.isComposing)return;
    if(e.key==='Escape'){e.preventDefault();if(power==='on')openApp('home');return;}
    if(power!=='on'){if((e.key==='Enter'||e.key===' ')&&e.target===device){e.preventDefault();boot();}return;}
    const editable=e.target.matches('input,textarea,select');
    if(editable){if(e.key==='Enter'&&e.target.id==='core-expression'){e.preventDefault();calculate();}if(e.key==='Enter'&&e.target.id==='core-equation'){e.preventDefault();plotEquation();}return;}
    if(app==='snake'){
      const d={ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right',w:'up',s:'down',a:'left',d:'right'}[e.key];
      if(d){e.preventDefault();direction(d);return;}
      if(e.key===' '){e.preventDefault();startSnake();return;}
    }
    if(app==='home'){
      const list=[...display.querySelectorAll('[data-open]')];let index=list.indexOf(document.activeElement);
      if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key)){e.preventDefault();const step={ArrowLeft:-1,ArrowRight:1,ArrowUp:-3,ArrowDown:3}[e.key];index=index<0?0:(index+step+6)%6;list[index].focus();return;}
      if(e.key==='Enter'&&e.target===device){e.preventDefault();openApp('calculator');return;}
    }
    if(e.target.tagName==='BUTTON'&&(e.key==='Enter'||e.key===' '))return;
    if(['home','calculator'].includes(app)){
      const map={Enter:'=',Backspace:'DEL',Delete:'AC'};const key=map[e.key]||(/^[0-9.+\-*/^()%]$/.test(e.key)?e.key:null);
      if(key){e.preventDefault();insertKey(key);}
    }
  });
  let tiltFrame=0;
  device.addEventListener('pointermove',e=>{
    if(reduced.matches||e.pointerType==='touch')return;
    cancelAnimationFrame(tiltFrame);tiltFrame=requestAnimationFrame(()=>{const r=device.getBoundingClientRect();device.style.setProperty('--core-rx',((.5-(e.clientY-r.top)/r.height)*2)+'deg');device.style.setProperty('--core-ry',(((e.clientX-r.left)/r.width-.5)*2)+'deg');});
  });
  function resetTilt(){cancelAnimationFrame(tiltFrame);device.style.removeProperty('--core-rx');device.style.removeProperty('--core-ry');}
  device.addEventListener('pointerleave',resetTilt);reduced.addEventListener('change',resetTilt);
  new ResizeObserver(()=>{drawGraph();drawSnake();}).observe(display);
  new IntersectionObserver(([entry])=>{if(!entry.isIntersecting)pauseSnake();}).observe(device);
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseSnake();});
  window.addEventListener('blur',pauseSnake);
  setInterval(()=>{if(power==='on'&&!document.hidden&&$('time'))$('time').textContent=clock();},30000);
  window.addEventListener('pagehide',()=>{save();clearTimeout(snake.timer);clearTimeout(bootTimer);cancelAnimationFrame(graphFrame);});
})();
