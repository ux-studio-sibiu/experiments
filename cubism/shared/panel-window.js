/* panel-window - the panel as a floating window, as in the randomize-studio (its js/panel-window.js, the
   window parts of it): dragged by its titlebar, and minimized towards the button that brings it back.
   The look of both is the studio's panel.css (vendor/randomize-studio/css/). */
(() => {
  const panel = document.getElementById('panel');
  const show = document.getElementById('panelShow');
  const head = panel.querySelector('.phead');

  /* ---- minimizing: the window shrinks into the maximize button, so you can see where it went ----
     The vector from the window's centre to the button's, as the two custom properties panel.css animates
     along. Measured each time, because the window can have been dragged anywhere by then. offsetLeft/Top
     rather than getBoundingClientRect: layout boxes ignore transforms, so this is where the window rests
     rather than where a shrink has got it to. */
  function dock() {
    // The button is display:none while the window is up; lend it a frame of layout to find where it will be.
    const wasStyle = show.getAttribute('style') || '';
    show.style.display = 'block';
    show.style.visibility = 'hidden';
    const b = show.getBoundingClientRect();
    show.setAttribute('style', wasStyle);

    const cx = panel.offsetLeft + panel.offsetWidth / 2;
    const cy = panel.offsetTop + panel.offsetHeight / 2;
    panel.style.setProperty('--dock-x', Math.round((b.left + b.right) / 2 - cx) + 'px');
    panel.style.setProperty('--dock-y', Math.round((b.top + b.bottom) / 2 - cy) + 'px');
  }

  document.getElementById('panelToggle').addEventListener('click', () => {
    dock();
    document.body.classList.add('panel-hidden');
  });
  // The window is already sitting on the docked transform, so dropping the class plays the same journey back.
  show.addEventListener('click', () => document.body.classList.remove('panel-hidden'));

  /* ---- dragging by the titlebar ----
     Pointer events, so a pen or a touch drags it too, with pointer capture so the window keeps following when
     the cursor outruns the handle. Written as left/top the moment a drag starts: until then the panel is
     anchored to the right edge by the stylesheet. */
  let dx = 0, dy = 0, dragging = false;

  // Always leaves the whole window on screen, which also keeps the titlebar reachable.
  const place = (x, y) => {
    const gap = 8, w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.round(Math.max(gap, Math.min(x, innerWidth - w - gap))) + 'px';
    panel.style.top = Math.round(Math.max(gap, Math.min(y, innerHeight - h - gap))) + 'px';
    panel.style.right = 'auto';
  };

  head.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    place(r.left, r.top);   // pin to left/top before the first move
    dragging = true;
    panel.classList.add('is-dragging');
    head.setPointerCapture(e.pointerId);
    e.preventDefault();     // no text selection while dragging
  });
  head.addEventListener('pointermove', (e) => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    if (head.hasPointerCapture(e.pointerId)) head.releasePointerCapture(e.pointerId);
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  // Double-click the handle to send it back to its corner.
  head.addEventListener('dblclick', (e) => {
    if (e.target.closest('button')) return;
    panel.style.left = panel.style.top = panel.style.right = '';
  });

  // A window dropped against the right of a wide window must not end up outside a narrow one. Only for one
  // that has been moved: an untouched panel is anchored by the stylesheet and looks after itself.
  addEventListener('resize', () => {
    if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top));
  });
})();
