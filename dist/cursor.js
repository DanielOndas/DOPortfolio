(() => {
  const cursor = document.querySelector('.cursor');
  const enabled = matchMedia('(hover: hover) and (pointer: fine) and (min-width: 761px) and (prefers-reduced-motion: no-preference)');
  function hide() {
    cursor.style.opacity = '0';
    document.documentElement.classList.remove('custom-cursor-active');
  }
  addEventListener('pointermove', event => {
    if (document.querySelector('.entry-lamp[open]') || !enabled.matches || event.pointerType === 'touch') {
      hide();
      return;
    }
    const host = document.querySelector('dialog[open]') || document.body;
    if (cursor.parentElement !== host) host.append(cursor);
    cursor.style.left = event.clientX + 'px';
    cursor.style.top = event.clientY + 'px';
    cursor.style.opacity = '1';
    cursor.classList.toggle('active', Boolean(event.target.closest('a,button,summary,.ribbon-map.is-over,.sculpture,.viewport,input')));
    document.documentElement.classList.add('custom-cursor-active');
  });
  document.querySelectorAll('iframe').forEach(frame => frame.addEventListener('pointerenter', hide));
  document.querySelectorAll('dialog').forEach(dialog => dialog.addEventListener('close', hide));
  document.documentElement.addEventListener('pointerleave', hide);
  addEventListener('blur', hide);
  addEventListener('pagehide', hide);
  enabled.addEventListener('change', hide);
})();
