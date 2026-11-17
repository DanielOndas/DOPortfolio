(() => {
  const section = document.querySelector('#inside-munly');
  const deck = section.querySelector('.cutaway-deck');
  const sheets = ['.dashboard-sheet', '.request-sheet', '.storage-sheet'].map(selector => deck.querySelector(selector));
  const handles = sheets.slice(0, 2).map(sheet => sheet.querySelector('button'));
  const stops = [...section.querySelectorAll('[data-depth]')];
  const note = section.querySelector('#sample-note');
  const runSave = section.querySelector('#run-save');
  const saved = section.querySelector('#save-result');
  const status = section.querySelector('#cutaway-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const descriptions = [
    ['The delegate’s workspace', 'Edit the sample note, then peel back the dashboard to see the request it would send.'],
    ['Inside the request', 'This sample request carries the edited note. Run it to update the stored record, or pull it aside to inspect storage first.'],
    ['Inside storage', 'The record holds the last saved note. Go back to the dashboard to try another edit.']
  ];
  const layers = sheets.map((element, i) => ({
    element, position: 0, velocity: 0, target: 0, direction: i === 1 ? 1 : -1
  }));
  let depth = 0;
  let revision = 1;
  let drag = null;
  let frame = 0;
  let previousTime = 0;

  function render() {
    layers.forEach((layer, i) => {
      const offset = layer.position;
      const below = Math.max(0, i - layers.slice(0, i).reduce((sum, item) => sum + Math.min(1, Math.abs(item.position)), 0));
      const lift = Math.min(1, Math.abs(offset));
      layer.element.style.transform = 'translate(' + (offset * 106 + below * 1.6) + '%, ' + (below * 3 - lift * 8) + '%) ' +
        'rotateY(' + (offset * -15) + 'deg) rotate(' + (below * 1.2 + offset * 8) + 'deg) scale(' + (1 - lift * .085) + ')';
    });
  }

  function tick(now) {
    const dt = Math.min((now - previousTime) / 1000 || 1/60, 1/30);
    previousTime = now;
    let active = false;
    for (const layer of layers) {
      // Substeps keep the spring stable across high-refresh and slower displays.
      for (let step = 0; step < 4; step++) {
        const acceleration = 310 * (layer.target - layer.position) - 25 * layer.velocity;
        layer.velocity += acceleration * dt / 4;
        layer.position += layer.velocity * dt / 4;
      }
      if (Math.abs(layer.target - layer.position) + Math.abs(layer.velocity) < .001) {
        layer.position = layer.target;
        layer.velocity = 0;
      } else active = true;
    }
    render();
    frame = active ? requestAnimationFrame(tick) : 0;
  }

  function animate() {
    if (reduced.matches) {
      cancelAnimationFrame(frame);
      frame = 0;
      layers.forEach(layer => {layer.position = layer.target; layer.velocity = 0;});
      render();
    } else if (!frame) {
      previousTime = performance.now();
      frame = requestAnimationFrame(tick);
    }
  }

  function selectLayer(index, announce = true) {
    const moveFocus = handles.includes(document.activeElement) || document.activeElement === runSave;
    drag = null;
    depth = index;
    layers.forEach((layer, i) => {
      layer.target = i < depth ? layer.direction : 0;
      layer.element.inert = i !== depth;
      stops[i].setAttribute('aria-pressed', String(i === depth));
    });
    const [title, description] = descriptions[depth];
    section.querySelector('#layer-title').textContent = title;
    section.querySelector('#layer-description').textContent = description;
    section.querySelector('.note-editor').hidden = depth !== 0;
    runSave.hidden = depth !== 1;
    saved.hidden = depth !== 2;
    saved.textContent = revision === 1 ? 'Original sample · Revision 1' : 'Sample saved · Revision ' + revision;
    if (announce) status.textContent = title + '. ' + description;
    if (moveFocus) (handles[depth] || stops[depth]).focus({preventScroll:true});
    animate();
  }

  handles.forEach((handle, i) => {
    let suppressClick = false;
    handle.addEventListener('pointerdown', e => {
      if (e.button !== 0 || drag || i !== depth) return;
      suppressClick = false;
      drag = {id:e.pointerId, x:e.clientX, y:e.clientY, moved:false, distance:0};
      handle.setPointerCapture(e.pointerId);
    });
    handle.addEventListener('pointermove', e => {
      if (!drag || drag.id !== e.pointerId) return;
      const dx = e.clientX - drag.x;
      if (!drag.moved && (Math.abs(dx) < 5 || Math.abs(dx) < Math.abs(e.clientY - drag.y))) return;
      drag.moved = true;
      drag.distance = dx / Math.max(1, deck.clientWidth);
      // Increasing resistance makes a short tug recoil and a deliberate pull detach.
      layers[i].target = Math.sign(dx) * Math.min(.96, 1 - Math.exp(-2 * Math.abs(drag.distance)));
      animate();
    });
    function release(e) {
      if (!drag || drag.id !== e.pointerId) return;
      const {moved, distance} = drag;
      drag = null;
      suppressClick = moved;
      if (e.type === 'pointerup' && moved && Math.abs(distance) >= .18) {
        layers[i].direction = Math.sign(distance);
        selectLayer(i + 1);
      } else {
        layers[i].target = 0;
        animate();
      }
    }
    handle.addEventListener('pointerup', release);
    handle.addEventListener('pointercancel', release);
    handle.addEventListener('lostpointercapture', release);
    handle.addEventListener('click', e => {
      if (i === depth && (!suppressClick || e.detail === 0)) selectLayer(i + 1);
      suppressClick = false;
    });
  });

  stops.forEach((button, i) => button.addEventListener('click', () => selectLayer(i)));
  function previewRequest() {
    section.querySelector('#request-body').textContent = JSON.stringify(note.value);
    runSave.disabled = !note.value.trim();
  }
  note.addEventListener('input', previewRequest);
  runSave.addEventListener('click', () => {
    section.querySelector('#stored-body').textContent = note.value;
    section.querySelector('#stored-revision').textContent = String(++revision);
    selectLayer(2);
    status.textContent = 'Sample saved. Revision ' + revision + '. ' + note.value;
  });
  reduced.addEventListener('change', animate);
  previewRequest();
  selectLayer(0, false);
})();
