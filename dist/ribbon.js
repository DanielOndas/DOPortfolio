'use strict';

(() => {
  const canvas = document.querySelector('#sculpture');
  const surface = canvas.closest('.sculpture');
  const context = canvas.getContext('2d');
  if (!context) return;

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const around = 100, across = 16;
  const vertices = [], faces = [];
  for (let i = 0; i <= around; i++) {
    const u = i / around * Math.PI * 2;
    for (let j = 0; j <= across; j++) {
      const v = j / across * Math.PI * 2 + 3 * u;
      vertices.push({...ribbonPoint(u, v), px: 0, py: 0, depth: 0});
    }
  }
  for (let i = 0; i < around; i++) {
    for (let j = 0; j < across; j++) {
      const start = i * (across + 1) + j;
      const a = vertices[start], b = vertices[start + across + 1];
      const c = vertices[start + across + 2], d = vertices[start + 1];
      const bx = b.x-a.x, by = b.y-a.y, bz = b.z-a.z;
      const cx = c.x-a.x, cy = c.y-a.y, cz = c.z-a.z;
      const nx = by*cz-bz*cy, ny = bz*cx-bx*cz, nz = bx*cy-by*cx;
      const length = Math.hypot(nx, ny, nz) || 1;
      faces.push({a, b, c, d, nx: nx/length, ny: ny/length, nz: nz/length, depth: 0});
    }
  }
  const palette = Array.from({length: 141}, (_, n) => 'rgb(' + (111+n) + ',' + (107+n) + ',' + (92+n) + ')');
  let width = 0, height = 0, angle = 0, tilt = 0;
  let lookX = 0, lookY = 0, speedX = 0, speedY = 0, pointer = null;
  let lastX = 0, lastY = 0, lastMove = 0, frame = 0, previous = 0, visible = false;

  function schedule() {
    if (!frame && visible && !document.hidden) frame = requestAnimationFrame(draw);
  }

  function draw(time) {
    frame = 0;
    if (!visible || document.hidden || !width || !height) return;
    const elapsed = time - previous;
    if (!reduced.matches && previous && elapsed < 1000/34) {
      schedule();
      return;
    }
    const dt = previous ? Math.min(elapsed, 60) : 16;
    previous = time;
    if (!reduced.matches && pointer === null) {
      const decay = Math.exp(-dt / 370);
      angle += dt * .00013 + speedX * 370 * (1 - decay);
      tilt += speedY * 370 * (1 - decay);
      speedX *= decay;
      speedY *= decay;
    }
    const ax = .65 + tilt + (reduced.matches ? 0 : lookY * .23);
    const ay = angle + (reduced.matches ? 0 : lookX * .35);
    const cx = Math.cos(ax), sx = Math.sin(ax), cy = Math.cos(ay), sy = Math.sin(ay);
    const cz = Math.cos(-.5), sz = Math.sin(-.5);
    // Rows of the rotation matrix are shared by the projected vertices and their lighting.
    const xx = cz*cy, xy = cz*sy*sx-sz*cx, xz = cz*sy*cx+sz*sx;
    const yx = sz*cy, yy = sz*sy*sx+cz*cx, yz = sz*sy*cx-cz*sx;
    const zx = -sy, zy = cy*sx, zz = cy*cx;
    const lx = -.5*xx-.65*yx+.8*zx, ly = -.5*xy-.65*yy+.8*zy, lz = -.5*xz-.65*yz+.8*zz;
    const scale = Math.min(width, height) * .235;
    for (const v of vertices) {
      v.depth = zx*v.x + zy*v.y + zz*v.z;
      const projection = scale * 4.8 / (4.8 - v.depth);
      v.px = (xx*v.x + xy*v.y + xz*v.z) * projection;
      v.py = (yx*v.x + yy*v.y + yz*v.z) * projection;
    }
    for (const f of faces) f.depth = f.a.depth + f.b.depth + f.c.depth + f.d.depth;
    faces.sort((a,b) => a.depth - b.depth);
    context.clearRect(0, 0, width, height);
    context.save();
    context.translate(width*.52, height*.51);
    context.shadowColor = '#26251f22';
    context.shadowBlur = 40;
    context.fillStyle = '#26251f12';
    context.beginPath();
    context.ellipse(5, scale*1.85, scale*1.15, scale*.11, 0, 0, Math.PI*2);
    context.fill();
    context.shadowBlur = 0;
    context.lineWidth = .7;
    for (const f of faces) {
      const light = Math.max(0, lx*f.nx + ly*f.ny + lz*f.nz);
      const color = palette[Math.min(140, Math.round(light*120))];
      context.fillStyle = color;
      context.strokeStyle = color;
      context.beginPath();
      context.moveTo(f.a.px, f.a.py);
      context.lineTo(f.b.px, f.b.py);
      context.lineTo(f.c.px, f.c.py);
      context.lineTo(f.d.px, f.d.py);
      context.closePath();
      context.fill();
      context.stroke();
    }
    context.restore();
    if (!reduced.matches) schedule();
  }

  function resize() {
    const rect = canvas.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    const resolution = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(width * resolution);
    canvas.height = Math.round(height * resolution);
    context.setTransform(resolution, 0, 0, resolution, 0, 0);
    schedule();
  }
  function stopThrow() { speedX = 0; speedY = 0; }
  surface.addEventListener('pointerdown', event => {
    if (pointer !== null || event.button !== 0) return;
    pointer = event.pointerId;
    lastX = event.clientX;
    lastY = event.clientY;
    lastMove = event.timeStamp;
    stopThrow();
    surface.setPointerCapture(pointer);
  });
  surface.addEventListener('pointermove', event => {
    if (pointer !== event.pointerId) return;
    const dx = (event.clientX - lastX) * .008, dy = (event.clientY - lastY) * .005;
    const dt = Math.max(5, event.timeStamp - lastMove);
    angle += dx;
    tilt += dy;
    speedX = Math.max(-.009, Math.min(.009, .35*speedX + .65*dx/dt));
    speedY = Math.max(-.007, Math.min(.007, .35*speedY + .65*dy/dt));
    lastMove = event.timeStamp;
    lastX = event.clientX;
    lastY = event.clientY;
    schedule();
  });
  function release(event) {
    if (event.pointerId !== pointer) return;
    if (event.type !== 'pointerup' || reduced.matches || event.timeStamp-lastMove > 95) stopThrow();
    pointer = null;
    schedule();
  }
  for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) surface.addEventListener(type, release);
  surface.addEventListener('keydown', event => {
    const direction = {ArrowLeft: [-1,0], ArrowRight: [1,0], ArrowUp: [0,-1], ArrowDown: [0,1]}[event.key];
    if (!direction) return;
    event.preventDefault();
    angle += direction[0] * .2;
    tilt += direction[1] * .2;
    speedX = reduced.matches ? 0 : direction[0] * .0017;
    speedY = reduced.matches ? 0 : direction[1] * .0017;
    schedule();
  });
  addEventListener('pointermove', event => {
    if (!visible || event.pointerType === 'touch' || pointer !== null || reduced.matches) return;
    lookX = event.clientX / innerWidth * 2 - 1;
    lookY = event.clientY / innerHeight * 2 - 1;
  }, {passive:true});
  function resume() {
    previous = 0;
    stopThrow();
    schedule();
  }
  new ResizeObserver(resize).observe(canvas);
  new IntersectionObserver(([entry]) => {visible = entry.isIntersecting; resume();}).observe(canvas);
  reduced.addEventListener('change', resume);
  document.addEventListener('visibilitychange', resume);
  resize();
})();
