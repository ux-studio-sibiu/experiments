// Fine tuning for every slider in a panel: a small stacked ▲ / ▼ pair at the end of the row, after the value, shown
// once the value is clicked.
// One step per click (the slider's own step), ten with Shift, repeating while held (one nudge, a pause, then
// every 50 ms: the timing of romanian-borders' FineRange). The wheel over the pair nudges too. They change the
// slider the way a drag does, by firing a bubbling input event, so the page's handlers and saved-ui.js see it.

const HOLD_DELAY = 400; // ms before a held arrow starts repeating
const HOLD_RATE = 50; // ms between repeats

function nudge(input, direction, shift) {
  const before = input.value;
  for (let i = 0; i < (shift ? 10 : 1); i++) direction > 0 ? input.stepUp() : input.stepDown(); // clamped to min / max
  if (input.value !== before) input.dispatchEvent(new Event('input', { bubbles: true }));
}

function makeArrow(input, direction, name) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = direction > 0 ? 'nudge-up' : 'nudge-down';
  button.setAttribute('aria-label', `${direction > 0 ? 'Increase' : 'Decrease'} ${name}`);
  button.title = 'Shift: 10 steps. Hold to repeat. Wheel works too.';

  let timer = 0;
  const stop = () => clearTimeout(timer);

  // pointer: act on press, so holding repeats without waiting for a click
  button.addEventListener('pointerdown', e => {
    if (e.button !== 0) return;
    e.preventDefault(); // keep focus off the tiny button, so the drag of a slider nearby isn't interrupted
    nudge(input, direction, e.shiftKey);
    const again = delay => { timer = setTimeout(() => { nudge(input, direction, e.shiftKey); again(HOLD_RATE); }, delay); };
    again(HOLD_DELAY);
  });
  button.addEventListener('pointerup', stop);
  button.addEventListener('pointerleave', stop);
  button.addEventListener('pointercancel', stop);
  // keyboard (Enter / Space) fires a click with no pointer press behind it (detail 0)
  button.addEventListener('click', e => { if (e.detail === 0) nudge(input, direction, e.shiftKey); });
  return button;
}

// The pair stays out of sight until the row's value is clicked (the row gets .is-tuning); a click anywhere outside
// that row puts it away again. Its room is kept while hidden, so nothing shifts when it shows.
export function fineTune(panel) {
  let open = null; // the row whose arrows show
  const close = () => { open?.classList.remove('is-tuning'); open = null; };
  document.addEventListener('pointerdown', e => { if (open && !open.contains(e.target)) close(); });

  for (const input of panel.querySelectorAll('.row > input[type="range"]')) {
    const row = input.closest('.row');
    const name = row.querySelector('label')?.textContent.trim() || input.name;
    const pair = document.createElement('span');
    pair.className = 'nudge-pair';
    pair.append(makeArrow(input, 1, name), makeArrow(input, -1, name));
    pair.addEventListener('wheel', e => { e.preventDefault(); nudge(input, e.deltaY < 0 ? 1 : -1, e.shiftKey); }, { passive: false });
    const value = row.querySelector('output');
    (value ?? input).after(pair);
    if (!value) { row.classList.add('is-tuning'); continue; } // nothing to click: the arrows always show

    value.tabIndex = 0;
    value.setAttribute('role', 'button');
    value.title = `Fine-tune ${name}`;
    const toggle = () => {
      const was = open === row;
      close();
      if (!was) { row.classList.add('is-tuning'); open = row; }
    };
    value.addEventListener('click', toggle);
    value.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); } });
  }
}
