'use strict';

(() => {
  const picker = document.querySelector('.project-picker');
  if (!picker) return;

  const choices = [...picker.querySelectorAll('button')];
  const pieces = choices.map(button => document.getElementById(button.getAttribute('aria-controls')));
  const header = document.querySelector('.desk-header');
  const motion = matchMedia('(prefers-reduced-motion: no-preference)');
  let selection = -1;
  let seen = false;

  function select(index) {
    if (selection === index) return;
    selection = index;
    choices.forEach((button, i) => {
      const selected = i === index;
      button.setAttribute('aria-pressed', String(selected));
      pieces[i].hidden = !selected;
      pieces[i].classList.toggle('arriving', selected && seen);
    });
  }

  choices.forEach((button, i) => {
    button.addEventListener('click', () => select(i));
    button.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
      event.preventDefault();
      const next = event.key === 'Home' ? 0 : event.key === 'End' ? choices.length - 1 :
        (i + (event.key === 'ArrowRight' ? 1 : -1) + choices.length) % choices.length;
      select(next);
      choices[next].focus();
    });
  });
  select(0);
  picker.hidden = false;
  const arrival = new IntersectionObserver(entries => {
    if (!entries.some(entry => entry.isIntersecting)) return;
    seen = true;
    header.classList.add('in-view');
    pieces[selection].classList.add('arriving');
    arrival.disconnect();
  }, {threshold: .12});
  arrival.observe(header);

  const folio = document.querySelector('.folio-table');
  const hint = folio.querySelector('.folio-hint');
  let open = false, peel = null, suppressTap = false;
  function setOpen(value) {
    open = value;
    folio.setAttribute('aria-pressed', String(open));
    folio.setAttribute('aria-label', open ? 'Close delegate folio' : 'Open delegate folio');
    hint.textContent = open ? 'Close folio' : 'Open folio';
    folio.title = open ? 'Click or drag right to close' : 'Click or drag left to open';
  }
  setOpen(false);
  folio.addEventListener('click', event => {
    if (!suppressTap || event.detail === 0) setOpen(!open);
    suppressTap = false;
  });
  folio.addEventListener('pointerdown', event => {
    if (event.button !== 0 || peel) return;
    suppressTap = false;
    peel = {id:event.pointerId, x:event.clientX, y:event.clientY, travel:Math.max(120, folio.clientWidth * .32), moved:false, amount:Number(open)};
    folio.setPointerCapture(event.pointerId);
  });
  folio.addEventListener('pointermove', event => {
    if (event.pointerId !== peel?.id) return;
    const dx = event.clientX - peel.x;
    if (!peel.moved && (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(event.clientY - peel.y))) return;
    peel.moved = true;
    peel.amount = Math.max(0, Math.min(1, Number(open) - dx / peel.travel));
    if (motion.matches) {
      folio.classList.add('is-peeling');
      folio.style.setProperty('--peel-angle', (-2 - 112 * peel.amount) + 'deg');
      folio.style.setProperty('--peel-shift', (7 * peel.amount) + '%');
      folio.style.setProperty('--peel-ink', Math.max(0, 1 - peel.amount * 1.4));
    }
  });
  function finishPeel(event) {
    if (event.pointerId !== peel?.id) return;
    suppressTap = peel.moved || event.type !== 'pointerup';
    if (peel.moved && event.type === 'pointerup') setOpen(peel.amount >= (open ? .7 : .3));
    peel = null;
    folio.classList.remove('is-peeling');
    for (const key of ['--peel-angle','--peel-shift','--peel-ink']) folio.style.removeProperty(key);
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) folio.addEventListener(type, finishPeel);

  const tilt = folio.querySelector('.object-tilt');
  let frame = 0;
  let point = null;
  function orient() {
    frame = 0;
    if (!point || !motion.matches) {
      tilt.style.removeProperty('--tilt-x');
      tilt.style.removeProperty('--tilt-y');
      return;
    }
    const box = folio.getBoundingClientRect();
    const x = (point.clientX - box.left) / box.width - .5;
    const y = (point.clientY - box.top) / box.height - .5;
    tilt.style.setProperty('--tilt-x', x * 15 + 'deg');
    tilt.style.setProperty('--tilt-y', -y * 12 + 'deg');
  }
  function updatePoint(event) {
    point = event;
    if (!frame) frame = requestAnimationFrame(orient);
  }
  folio.addEventListener('pointermove', event => {
    if (event.pointerType !== 'touch' && motion.matches) updatePoint(event);
  });
  folio.addEventListener('pointerleave', () => updatePoint(null));
  motion.addEventListener('change', () => updatePoint(null));


})();

(() => {
  const notes = [...document.querySelectorAll('.proof-notes details')];
  const proof = document.querySelector('.proof-view');
  if (!proof) return;
  for (const note of notes) {
    note.addEventListener('toggle', () => {
      if (note.open) proof.dataset.proof = note.dataset.proof;
      else if (!notes.some(other => other.open)) proof.dataset.proof = 'first';
    });
  }
})();

(() => {
  const ticket = document.querySelector('#copy-email');
  if (!ticket) return;
  const address = document.querySelector('.contact-bottom a[href^="mailto:"]');
  const label = ticket.querySelector('.tear-label');
  const status = document.querySelector('#copy-status');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let drag = null, timer = 0, sequence = 0;
  let ignoreClick = false;

  async function copy() {
    const attempt = ++sequence;
    clearTimeout(timer);
    let copied = false;
    try {
      await navigator.clipboard.writeText(address.textContent.trim());
      copied = true;
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(address);
      selection.removeAllRanges();
      selection.addRange(range);
      try { copied = document.execCommand('copy'); } catch {}
      if (copied) selection.removeAllRanges();
    }
    if (attempt !== sequence) return;
    label.textContent = copied ? 'Copied ✓' : 'Email selected';
    status.textContent = copied ? 'Email address copied.' : 'Email address selected. Use your device’s copy command.';
    ticket.classList.toggle('torn', copied);
    timer = setTimeout(() => {
      ticket.classList.remove('torn');
      label.textContent = 'Copy email';
    }, 1900);
  }

  ticket.addEventListener('pointerdown', event => {
    if (event.button !== 0 || drag) return;
    ignoreClick = false;
    drag = {id:event.pointerId, x:event.clientX, distance:0};
    ticket.setPointerCapture(event.pointerId);
  });
  ticket.addEventListener('pointermove', event => {
    if (drag?.id !== event.pointerId) return;
    drag.distance = event.clientX - drag.x;
    if (!reduced.matches) ticket.style.setProperty('--pull', Math.min(44, Math.max(0, drag.distance) * .58) + 'px');
  });
  function release(event) {
    if (drag?.id !== event.pointerId) return;
    const {distance} = drag;
    drag = null;
    ticket.style.removeProperty('--pull');
    ignoreClick = event.type !== 'pointerup' || Math.abs(distance) > 6;
    if (event.type === 'pointerup' && distance > 40) copy();
  }
  for (const type of ['pointerup','pointercancel','lostpointercapture']) ticket.addEventListener(type, release);
  ticket.addEventListener('click', event => {
    if (!ignoreClick || event.detail === 0) copy();
    ignoreClick = false;
  });
})();
