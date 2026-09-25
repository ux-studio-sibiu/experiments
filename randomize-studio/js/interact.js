/* interact — the cover as a canvas.
   Select, drag, resize, type into and nudge a block. Pointer listeners live on
   the document rather than the block: a drag has to keep tracking once the
   pointer has left what it picked up. */

/* ============================ select / move / edit ============================
   The stage behaves like a canvas. One click selects a block and brings its
   controls up in the panel; dragging a selected block places it anywhere,
   including past the edge of the content column or half off the screen, which
   is a legitimate cover layout and so is deliberately not clamped. Typing is a
   separate mode you enter with a double-click — with contenteditable off the
   rest of the time, a drag can never turn into a text selection, and the R key
   still randomizes while a block is merely selected.
   ========================================================================== */
/* A selection is a set plus a primary — the one clicked last. Everything in the
   set moves together; the primary is the one the panel is showing controls for
   and the only one that wears a name tag, because four tags at once is clutter
   and the question a tag answers is "which block are these controls editing?" */
const selected = new Set();
let primary = null, editing = null;

// Position only, no other styles — cheap enough to run on every pointermove.
const applyMove = (key) => {
  // The menu is measured from whichever point its anchor names, so there is one
  // function that knows how to place it and this is not it.
  if (key === 'topmenu') return placeMenu();
  const c = state[key], el = els[key];
  el.style.left = c.x + 'px';
  el.style.top = c.y + 'px';
};
function paintSelection() {
  Object.entries(els).forEach(([k, el]) => {
    el.classList.toggle('is-selected', selected.has(k));
    el.classList.toggle('is-primary', k === primary);
  });
  // Straight away, not on the next frame: selecting is a discrete click, one
  // layout read costs nothing there, and the mark should not trail the pointer.
  // queueFrame() is for the high-frequency path — a slider being dragged.
  placeFrame();
}

/* ---- the resize frame ----
   Four handles over the bounding box of the selection. Reading a rect forces
   layout, and this has to be refreshed after anything that could move a block —
   which is every slider tick — so the work is coalesced onto one frame rather
   than run inline. */
const selFrame = $('selFrame');
// The pending flag lives on the function rather than in a `let` beside it:
// fitScene() calls this while the module is still evaluating, and a `let` up
// here would still be in its temporal dead zone. Reading a missing property is
// merely falsy, and by the time the frame callback runs everything exists.
function queueFrame() {
  if (queueFrame.pending) return;
  queueFrame.pending = true;
  requestAnimationFrame(() => { queueFrame.pending = false; placeFrame(); });
}
// The frame sits on the PRIMARY, not on the union of the selection: its only
// job is to carry the resize handles, and resizing sets one block's box. The
// other selected blocks still show their own outlines and move with the drag.
function placeFrame() {
  const r = (!editing && primary) ? els[primary].getBoundingClientRect() : null;
  const box = r && (r.width || r.height) ? r : null;     // a hidden menu has no box
  document.body.classList.toggle('has-selection', !!box);
  if (!box) return;
  selFrame.style.left = box.left + 'px';
  selFrame.style.top = box.top + 'px';
  selFrame.style.width = box.width + 'px';
  selFrame.style.height = box.height + 'px';
}
// Text reflows when a webfont finally arrives, which changes the box after the
// render that asked for it. An observer catches that; nothing else would.
const frameWatch = new ResizeObserver(queueFrame);
BLOCKS.forEach(k => frameWatch.observe(els[k]));

/* ---- resizing: the corners size the box the text flows in ----
   Not the type — the frame. Width sets where the copy wraps, height gives the
   box room, and the text reflows inside whatever that leaves. Type size stays
   where it belongs, on its slider.

   The opposite corner stays put, which is the whole reason this is not just
   "add the delta to the width": pulling the left edge leftward widens the box
   AND shifts the block by the same amount, so the right edge does not travel.

   Everything is measured against the geometry captured on pointerdown, so the
   text rewrapping at the new width cannot feed back into the number. A block
   with no box yet is measured as it currently renders, which is what makes the
   first grab continue from where the text already is rather than jumping. */
const CORNERS = { nw: [-1,-1], ne: [1,-1], se: [1,1], sw: [-1,1] };
const MIN_BOX = 40;             // small enough to be useful, big enough to grab back
let resizing = null;

selFrame.querySelectorAll('.handle').forEach(handle => {
  handle.addEventListener('pointerdown', e => {
    if (e.button !== 0 || !primary) return;
    e.stopPropagation();        // neither a click on a block nor one on the backdrop
    const key = primary;
    const [sx, sy] = CORNERS[handle.dataset.corner];
    const scale = key === 'topmenu' ? 1 : sceneScale;   // the menu is in screen px
    // Seed from the box it has been GIVEN, falling back to how it currently
    // renders. Re-seeding from the rendered size every grab would make a block
    // whose text is taller than its box creep a little each time, because
    // min-height cannot make a box shorter than its copy.
    const c = state[key], r = els[key].getBoundingClientRect();
    resizing = {
      key, sx, sy, scale,
      px: e.clientX, py: e.clientY,
      w: c.boxW ?? Math.round(r.width / scale),
      h: c.boxH ?? Math.round(r.height / scale),
      x: c.x, y: c.y,
    };
    handle.setPointerCapture(e.pointerId);
  });
  // Back to auto — as wide as the column, as tall as the copy needs.
  handle.addEventListener('dblclick', () => {
    if (!primary) return;
    state[primary].boxW = state[primary].boxH = null;
    render();
  });
});

document.addEventListener('pointermove', e => {
  if (!resizing) return;
  const { key, sx, sy, scale } = resizing;
  const c = state[key];
  const dx = (e.clientX - resizing.px) / scale;
  const dy = (e.clientY - resizing.py) / scale;
  c.boxW = Math.max(MIN_BOX, Math.round(resizing.w + dx * sx));
  c.boxH = Math.max(MIN_BOX, Math.round(resizing.h + dy * sy));
  // The opposite corner stays put: an edge that moves takes the block's own
  // position with it by however much the box actually grew. Plain arithmetic
  // now that blocks are positioned absolutely — there is no flow left to shift
  // them, so nothing has to be measured after the fact.
  c.x = sx < 0 ? resizing.x + (resizing.w - c.boxW) : resizing.x;
  c.y = sy < 0 ? resizing.y + (resizing.h - c.boxH) : resizing.y;
  els[key].dataset.move = `   ${c.boxW} × ${c.boxH}`;
  render();
});
const endResize = () => {
  if (!resizing) return;
  const { key } = resizing;
  resizing = null;
  els[key].removeAttribute('data-move');
  queueFrame();
};
document.addEventListener('pointerup', endResize);
document.addEventListener('pointercancel', endResize);

// `additive` is a ctrl/cmd/shift-click: it toggles one block in or out and
// leaves the rest alone. A plain click replaces the selection outright.
function select(key, additive) {
  stopEditing();
  const was = primary;
  if (additive) {
    if (selected.has(key)) {
      selected.delete(key);
      // Dropping the primary hands the title to whatever is still selected, so
      // the panel always shows something that is actually selected.
      if (primary === key) primary = [...selected].pop() || null;
    } else {
      selected.add(key);
      primary = key;
    }
  } else {
    selected.clear();
    selected.add(key);
    primary = key;
  }
  paintSelection();
  // Only on a change: openSection collapses the other sections and scrolls, and
  // doing that again for a block already showing is a jolt for nothing.
  if (primary && primary !== was) openSection(primary);
}
function deselect() {
  stopEditing();
  selected.clear();
  primary = null;
  paintSelection();
}

// Drop the caret where the pointer went down rather than at the start of the
// block. Chromium and Firefox spell this differently and neither has both.
function placeCaret(el, x, y) {
  let range = null;
  if (document.caretRangeFromPoint) range = document.caretRangeFromPoint(x, y);
  else if (document.caretPositionFromPoint) {
    const p = document.caretPositionFromPoint(x, y);
    if (p) { range = document.createRange(); range.setStart(p.offsetNode, p.offset); }
  }
  // Blocks can be dragged over one another, so the point may well resolve into
  // a different one. The caret belongs in the block being edited or nowhere;
  // fall back to the end of it.
  if (!range || !el.contains(range.startContainer)) {
    range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
  }
  range.collapse(true);
  const sel = getSelection(); sel.removeAllRanges(); sel.addRange(range);
}
function startEditing(key, x, y) {
  if (key === 'topmenu') return;            // the menu is generated, not typed
  const el = els[key];
  editing = key;
  el.contentEditable = 'true';
  el.classList.add('is-editing');
  el.focus();
  placeCaret(el, x, y);
}
function stopEditing() {
  if (!editing) return;
  const el = els[editing];
  el.contentEditable = 'false';
  el.classList.remove('is-editing');
  el.blur();
  editing = null;
}

// { keys, sx, sy, start, collapseTo, moving } while the pointer is down on a block
let drag = null;
const signed = (n) => (n >= 0 ? '+' : '') + n;

Object.entries(els).forEach(([key, el]) => {
  el.addEventListener('pointerdown', e => {
    if (e.button !== 0 || editing === key) return;   // inside a block being typed in, the caret wins
    const additive = e.ctrlKey || e.metaKey || e.shiftKey;
    const wasSelected = selected.has(key);

    if (additive || !wasSelected) {
      select(key, additive);
    } else if (primary !== key) {
      // Already selected, plain click: make it the primary without disturbing
      // the rest of the selection.
      primary = key;
      paintSelection();
      openSection(key);
    }

    if (!selected.has(key)) { drag = null; return; }   // a ctrl-click that deselected it
    drag = {
      keys: [...selected],
      sx: e.clientX, sy: e.clientY,
      start: Object.fromEntries([...selected].map(k => [k, { x: state[k].x, y: state[k].y }])),
      // A plain click on a block that is already part of a multi-selection must
      // NOT collapse the selection on the way down, or a selection could never
      // be dragged at all. Collapse on the way back up instead, and only if
      // nothing moved — which is the difference between a click and a drag.
      collapseTo: (!additive && wasSelected && selected.size > 1) ? key : null,
      moving: false,
    };
  });
  // Typing happens in one block, so entering edit mode collapses the selection.
  el.addEventListener('dblclick', e => { select(key, false); startEditing(key, e.clientX, e.clientY); });
  el.addEventListener('dragstart', e => e.preventDefault());   // no native drag of the menu's links
  el.addEventListener('click', e => e.preventDefault());       // ...and they go nowhere
});

// On the document rather than on the block, and without pointer capture. A
// block is a line of text, so a drag of any speed leaves it within the first
// event and a listener bound to it would never hear the rest; capture would fix
// that, but taking it on pointerdown suppresses the compatibility mouse events,
// and with them the double-click that opens text editing.
document.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  // A click is not a drag: nothing moves until the pointer has travelled far
  // enough that it cannot have been meant as one.
  if (!drag.moving && Math.hypot(dx, dy) < 3) return;
  if (!drag.moving) {
    drag.moving = true;
    drag.collapseTo = null;              // it became a drag, so nothing collapses
    document.body.classList.add('is-moving');
    drag.keys.forEach(k => els[k].classList.add('is-moving'));
  }
  // One pointer delta applied to every block in the selection, each from where
  // it started, so the group keeps its internal spacing.
  //
  // The pointer moves in device pixels; a block on the cover lives in artboard
  // ones. The menu is the exception — it is anchored to the screen, so its
  // offset is already in the pointer's units, and in a mixed selection the two
  // still travel the same distance on screen. The threshold above stays in
  // device pixels either way: it is about how far a hand travelled.
  drag.keys.forEach(k => {
    const scale = k === 'topmenu' ? 1 : sceneScale;
    const s = drag.start[k];
    const c = state[k];
    c.x = Math.round(s.x + dx / scale);
    c.y = Math.round(s.y + dy / scale);
    if (k === primary) els[k].dataset.move = `   ${signed(c.x)}, ${signed(c.y)}`;
    applyMove(k);
  });
  // Straight away rather than on the next frame: the handles belong to the
  // block, so they have to travel with it — and queueFrame() would leave them
  // a frame behind the pointer.
  placeFrame();
});
const endDrag = () => {
  if (!drag) return;
  const { keys, collapseTo } = drag;
  drag = null;
  keys.forEach(k => { els[k].classList.remove('is-moving'); els[k].removeAttribute('data-move'); });
  document.body.classList.remove('is-moving');
  if (collapseTo) select(collapseTo, false);   // it was a click after all
};
document.addEventListener('pointerup', endDrag);
document.addEventListener('pointercancel', endDrag);

// Clicking the backdrop drops the selection, the way it does on any canvas.
document.querySelector('.stage').addEventListener('pointerdown', e => {
  if (!e.target.closest('.editable')) deselect();
});
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  if (editing) stopEditing(); else deselect();
});

// A keystroke belongs to whatever has focus. In a panel control the arrows are
// the slider's, and in a block being typed in they are the caret's — so every
// shortcut on the stage has to stand down for both.
const typingInto = () => {
  const el = document.activeElement;
  return !!el && (el.isContentEditable || /^(INPUT|SELECT|TEXTAREA)$/.test(el.tagName));
};

/* ---- nudging with the arrow keys ----
   The pointer places a block, the arrows place it exactly. One unit per press
   in the block's OWN space — artboard pixels on the cover, screen pixels for
   the menu — because that is what every number in the panel already means.
   Shift takes ten, the step this kind of tool always uses.

   The whole selection moves, as it does under a drag. Key repeat does the rest,
   so holding an arrow walks the block along. */
const NUDGE = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
let nudgeTimer = 0;
document.addEventListener('keydown', e => {
  const step = NUDGE[e.key];
  if (!step || !selected.size || editing || typingInto()) return;
  // An arrow pressed inside the panel belongs to the panel — stepping through
  // the scene list, say — and not to whatever is selected on the cover.
  if (e.target.closest && e.target.closest('.panel')) return;
  if (e.metaKey || e.ctrlKey || e.altKey) return;    // those belong to the browser
  e.preventDefault();
  const by = e.shiftKey ? 10 : 1;
  selected.forEach(k => {
    state[k].x += step[0] * by;
    state[k].y += step[1] * by;
    applyMove(k);
  });
  placeFrame();
  // The panel has no x/y field, so the block's own tag is the read-out. Held
  // rather than flashed, and cleared a beat after the last press — on the
  // element captured now, because the primary may have moved on by then.
  const tagged = els[primary], c = state[primary];
  tagged.dataset.move = `   ${signed(c.x)}, ${signed(c.y)}`;
  clearTimeout(nudgeTimer);
  nudgeTimer = setTimeout(() => tagged.removeAttribute('data-move'), 900);
});
