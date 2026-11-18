// Keeps a panel's control values. Two layers, one record each per page (each page has its own controls):
// - the tab: every change goes to sessionStorage, so a refresh keeps it; closing the tab clears it
// - saved: the save button writes the current values to localStorage, the look a new visit starts from;
//   the reset button forgets them and puts every control back to its HTML default
// On load the tab's values win, then the saved ones, then the HTML defaults. Generic: it reads every named
// range, colour, checkbox and radio in the panel, so a new control is remembered without touching this file.

const tabKey = `interactive-particles:ui:${location.pathname}`;
const savedKey = `interactive-particles:ui-saved:${location.pathname}`;

function controls(panel) {
  return [...panel.querySelectorAll('input[name]')].filter(input => ['range', 'color', 'checkbox', 'radio'].includes(input.type));
}

function read(panel) {
  const state = {};
  for (const input of controls(panel)) {
    if (input.type === 'range' || input.type === 'color') state[input.name] = input.value;
    else if (input.type === 'checkbox') state[input.name] = input.checked;
    else if (input.checked) state[input.name] = input.value;
  }
  return state;
}

function load(storage, key) {
  try { return JSON.parse(storage.getItem(key)); } catch { return null; }
}

function store(storage, key, state) {
  try { storage.setItem(key, JSON.stringify(state)); return true; } catch { return false; }
}

// Set controls to new values, firing the same events a person would, so the page's own handlers apply them.
// valueOf(input) gives the value to set, or undefined to leave that control alone.
function apply(panel, valueOf) {
  for (const input of controls(panel)) {
    const value = valueOf(input);
    if (value === undefined) continue;
    if (input.type === 'range' || input.type === 'color') {
      if (input.value === value) continue;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
    } else if (input.type === 'checkbox') {
      if (input.checked === value) continue;
      input.checked = value;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    } else if (input.value === value && !input.checked) {
      input.checked = true;
      input.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
}

// Put the remembered values back. Call it after the handlers are bound.
export function restoreUi(panel) {
  const state = load(sessionStorage, tabKey) ?? load(localStorage, savedKey);
  if (state) apply(panel, input => state[input.name]);

  const keep = () => store(sessionStorage, tabKey, read(panel));
  panel.addEventListener('input', keep);
  panel.addEventListener('change', keep);
}

// The save button: the current values become the look this page opens with, from now on. Flashes inverted
// once stored, as the copy button does.
export function bindSaveButton(button, panel) {
  let timer = 0;
  button.addEventListener('click', () => {
    if (!store(localStorage, savedKey, read(panel))) return; // storage blocked: nothing saved, nothing to flash
    button.classList.add('is-saved');
    clearTimeout(timer);
    timer = setTimeout(() => button.classList.remove('is-saved'), 900);
  });
}

// The reset button: every control back to the default written in the HTML, and the saved settings forgotten, so
// a new visit opens with the defaults too. The image is not touched: that has its own back-to-default button.
export function bindResetButton(button, panel) {
  let timer = 0;
  button.addEventListener('click', () => {
    try { localStorage.removeItem(savedKey); } catch {}
    apply(panel, input => {
      if (input.type === 'range' || input.type === 'color') return input.defaultValue;
      if (input.type === 'checkbox') return input.defaultChecked;
      return input.defaultChecked ? input.value : undefined;
    });
    // the bubbling events above have just rewritten the tab's record with the defaults; drop it, there's nothing to keep
    try { sessionStorage.removeItem(tabKey); } catch {}
    button.classList.add('is-reset');
    clearTimeout(timer);
    timer = setTimeout(() => button.classList.remove('is-reset'), 900);
  });
}
