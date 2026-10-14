/*
 * Row scroll: the wheel carries on from one row into the next.
 *
 * The page is a vertical Sly of rows (window.arhSly.rows), each row a
 * horizontal Sly (window.arhSly.row[i]) that the wheel scrolls sideways.
 * Here, scrolling DOWN at a row's right end slides to the next row (landing
 * at its start), and scrolling UP at a row's left end slides to the previous
 * row, also landing at its start: every row is arrived at from its left.
 *
 * Feel, not logic, is the hard part, and these keep it calm:
 *  - a gesture only changes rows if the row was already RESTING at that edge
 *    when the gesture began (DWELL), so the flick that reaches the edge stops
 *    there instead of carrying on into the next row;
 *  - a gesture is a run of wheel events with no gap longer than GESTURE_GAP,
 *    which is what keeps a trackpad's momentum from counting as new gestures;
 *  - one change per gesture, and none for LOCK ms after one, so nothing can
 *    skip a row;
 *  - sideways swipes (more x than y) never change rows.
 *
 * The right and left arrow keys roll over at the edges the same way.
 *
 * window.arhSly is set by the page's own script (inline in index.html, and in
 * its sources js/main.js and index.max.html). This file only listens; it
 * never blocks the wheel, so the rows still scroll exactly as before.
 */
(function () {
  var DWELL = 50;         // ms the row must have been still at the edge
  var GESTURE_GAP = 200;  // ms of wheel silence that ends a gesture
  var LOCK = 600;         // ms after a row change before another
  var EDGE = 2;           // px of slack at the ends

  function now() { return new Date().getTime(); }

  $(function () {
    var sly = window.arhSly;
    if (!sly) return;
    var rows = sly.rows;
    var row = sly.row;

    var lastMove = 0;   // any row moved
    var lastWheel = 0;
    var lastJump = 0;
    var gesture = null; // { dir, armed, done }

    $.each(row, function (i, r) {
      if (r) r.on('move', function () { lastMove = now(); });
    });

    // The rows left behind go back to their start once the slide to the new
    // row is over (Sly's speed is 200ms), when they are off screen and the jump
    // is never seen. The page's own script does the same on the rows slider's
    // moveEnd, but that event does not always fire, so this timer makes sure.
    var resetTimer;
    rows.on('active', function () {
      clearTimeout(resetTimer);
      resetTimer = setTimeout(function () {
        var c = rows.rel.activeItem;
        $.each(row, function (k, r) {
          if (r && k !== c && r.pos.dest !== r.pos.start) r.toStart(undefined, true);
        });
      }, 350);
    });

    function current() { return row[rows.rel.activeItem]; }
    // pos.dest, not pos.cur: where the row is going (or has stopped), so the
    // check does not depend on how far its animation has got.
    function atStart(r) { return r.pos.dest <= r.pos.start + EDGE; }
    function atEnd(r) { return r.pos.dest >= r.pos.end - EDGE; }

    // Change rows; false when there is no row that way.
    function go(dir) {
      var target = rows.rel.activeItem + dir;
      if (target < 0 || target >= rows.items.length) return false;
      lastJump = now();
      if (dir > 0) rows.next();
      else rows.prev();
      return true;
    }

    // Capture, so this sees the event before Sly's own handler moves the row:
    // "was it already at the edge" has to be asked before the step is taken.
    document.addEventListener('wheel', function (e) {
      var t = now();
      var newGesture = t - lastWheel > GESTURE_GAP;
      lastWheel = t;

      var r = current();
      if (!r || e.deltaY === 0 || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
      var dir = e.deltaY > 0 ? 1 : -1;

      if (newGesture) {
        var resting = t - lastMove > DWELL;
        gesture = { dir: dir, armed: resting && (dir > 0 ? atEnd(r) : atStart(r)), done: false };
      }
      if (!gesture || gesture.done || !gesture.armed || gesture.dir !== dir) return;
      if (t - lastJump < LOCK) return;
      gesture.done = go(dir);
    }, { capture: true, passive: true });

    // Sly (this 2013 version) scrolls rows on the older mousewheel /
    // DOMMouseScroll events, which a browser sends right after each wheel
    // event. Once a gesture has changed rows, the rest of it is swallowed
    // here: otherwise the notch that changed rows would still nudge the row
    // just left, and a trackpad's momentum would carry on into the new one.
    function swallow(e) {
      if (gesture && gesture.done && now() - lastWheel <= GESTURE_GAP) e.stopPropagation();
    }
    document.addEventListener('mousewheel', swallow, true);
    document.addEventListener('DOMMouseScroll', swallow, true);

    // Arrow keys: the page slides a row by part of the screen per press; at
    // the edge a further press moves to the next or previous row instead.
    // A press that changes rows is kept from the page's own arrow handler,
    // which would otherwise slide the row just arrived at along by a step.
    document.addEventListener('keydown', function (e) {
      var r = current();
      if (!r || now() - lastJump < LOCK) return;
      var moved = (e.keyCode === 39 && atEnd(r) && go(1)) || (e.keyCode === 37 && atStart(r) && go(-1));
      if (moved) {
        e.stopImmediatePropagation();
        e.stopPropagation();
      }
    }, true);
  });
})();
