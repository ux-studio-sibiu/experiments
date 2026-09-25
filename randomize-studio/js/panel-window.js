/* panel-window — the panel as a floating window.
   Dragging it by its titlebar, minimizing it towards the button that brings it
   back, and the Copy CSS export. */

/* ---- where the window goes when it is minimized ----
   The vector from the window's centre to the maximize button's, written as two
   custom properties the stylesheet animates along. Measured each time, because
   the window can have been dragged anywhere by then.

   offsetLeft/Top rather than getBoundingClientRect: those are LAYOUT boxes and
   ignore transforms, so this measures where the window RESTS rather than where
   the shrink has currently got it to. */
function dockPanel() {
  const panel = $('panel'), show = $('panelShow');
  // The button is display:none while the window is up, so lend it a frame of
  // layout to find out where it is going to be.
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

$('panelToggle').addEventListener('click', () => {
  dockPanel();
  document.body.classList.add('panel-hidden');
});
// Nothing to recompute here: the window is already sitting on the docked
// transform, so dropping the class plays that same journey backwards. Setting
// the vars again would not help — both happen in one style recalc, so the
// transition would still start from the transform already in effect.
$('panelShow').addEventListener('click', () => document.body.classList.remove('panel-hidden'));

/* ---- the panel is a floating window: drag it by its titlebar ----
   Pointer events rather than mouse ones, so a pen or a touch drags it too, and
   pointer capture so the window keeps following even when the cursor outruns
   the handle. Position is written as left/top the moment a drag starts — the
   panel is anchored to the right edge until then, and the two cannot both be
   set. */
(() => {
  const panel = $('panel'), head = panel.querySelector('.phead');
  let dx = 0, dy = 0, dragging = false;

  // Always leaves the whole window on screen, which is also what keeps the
  // titlebar reachable: drag it off the top and there is no way to get it back.
  const place = (x, y) => {
    const gap = 8, w = panel.offsetWidth, h = panel.offsetHeight;
    panel.style.left = Math.round(Math.max(gap, Math.min(x, innerWidth - w - gap))) + 'px';
    panel.style.top = Math.round(Math.max(gap, Math.min(y, innerHeight - h - gap))) + 'px';
    panel.style.right = 'auto';
  };

  head.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('button')) return;
    const r = panel.getBoundingClientRect();
    dx = e.clientX - r.left; dy = e.clientY - r.top;
    place(r.left, r.top);                       // pin to left/top before the first move
    dragging = true;
    panel.classList.add('is-dragging');
    head.setPointerCapture(e.pointerId);
    e.preventDefault();                         // no text selection while dragging
  });
  head.addEventListener('pointermove', e => { if (dragging) place(e.clientX - dx, e.clientY - dy); });
  const endDrag = e => {
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('is-dragging');
    if (head.hasPointerCapture(e.pointerId)) head.releasePointerCapture(e.pointerId);
  };
  head.addEventListener('pointerup', endDrag);
  head.addEventListener('pointercancel', endDrag);

  // Double-click the handle to send it back to its corner.
  head.addEventListener('dblclick', e => {
    if (e.target.closest('button')) return;
    panel.style.left = panel.style.top = panel.style.right = '';
  });

  // A window dropped against the right edge of a wide viewport must not end up
  // outside a narrow one. Only for a panel that has been moved: an untouched
  // one is still anchored by CSS and looks after itself.
  addEventListener('resize', () => {
    if (panel.style.left) place(parseFloat(panel.style.left), parseFloat(panel.style.top));
  });
})();
document.addEventListener('keydown', e => {
  if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey && !typingInto()) {
    e.preventDefault(); randomizeRoles(false);
  }
});

/* ============================ copy CSS ============================ */
function familyAxis(name){ const f=byName(name); const w=[...f.w].sort((a,b)=>a-b);
  return name.replace(/ /g,'+') + ':' + (f.i ? 'ital,wght@'+w.map(x=>`0,${x}`).concat(w.map(x=>`1,${x}`)).join(';') : 'wght@'+w.join(';')); }
$('copyCss')?.addEventListener('click', async () => {
  const fams = [...new Set([state.heading.font, state.subheading.font, state.body.font])];
  const url = `https://fonts.googleapis.com/css2?${fams.map(f=>'family='+familyAxis(f)).join('&')}&display=swap`;
  const rule = (sel,c) => `${sel} {\n  font-family: '${c.font}', ${FB[byName(c.font).c]};\n  font-weight: ${c.weight};\n  font-style: ${c.italic?'italic':'normal'};\n  font-size: ${c.size}px;\n  line-height: ${c.lh};\n  letter-spacing: ${c.ls}em;\n  text-transform: ${c.transform};${c.columns?`\n  column-count: ${c.columns};`:''}\n}`;
  const css = `/* Google Fonts */\n@import url('${url}');\n\n` +
    rule('h1', state.heading) + '\n\n' + rule('.subheading', state.subheading) + '\n\n' + rule('.body', state.body) + '\n';
  try { await navigator.clipboard.writeText(css); flash('Copied CSS ✓'); }
  catch { flash('Copy blocked — see console'); console.log(css); }
});
function flash(msg){ const b=$('copyCss'); if (!b) return; const t=b.textContent; b.textContent=msg; setTimeout(()=>b.textContent=t,1200); }
