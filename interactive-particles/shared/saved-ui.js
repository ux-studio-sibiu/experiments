// Keeps a panel's control values for the tab: every change goes to sessionStorage, one record per page, so a refresh
// keeps it; closing the tab clears it, and a new visit opens with the HTML defaults. Generic: it reads every named
// range, colour, checkbox, radio, text field and textarea in the panel, so a new control is remembered without touching this file.
// Each record carries the HTML defaults it was made under: once the page's defaults change, older records are
// dropped, so the page opens with its new defaults instead of a look kept from before.

const tabKey = `interactive-particles:ui:${location.pathname}`;
// the saved look a save button once kept (gone): its record is cleared on load, nothing reads it
const oldSavedKey = `interactive-particles:ui-saved:${location.pathname}`;

function controls(panel) {
  return [...panel.querySelectorAll('input[name], textarea[name]')].filter(input => ['range', 'color', 'checkbox', 'radio', 'text', 'textarea'].includes(input.type));
}

function read(panel) {
  const state = {};
  for (const input of controls(panel)) {
    if (['range', 'color', 'text', 'textarea'].includes(input.type)) state[input.name] = input.value;
    else if (input.type === 'checkbox') state[input.name] = input.checked;
    else if (input.checked) state[input.name] = input.value;
  }
  return state;
}

// the panel's HTML defaults, as one string: what a record was made under
function defaultsOf(panel) {
  return JSON.stringify(controls(panel).map(input => [input.name, ['range', 'color', 'text', 'textarea'].includes(input.type) ? input.defaultValue : input.defaultChecked]));
}

// a record's values, if it was made under the current defaults; an older one is removed
function load(storage, key, panel) {
  try {
    const record = JSON.parse(storage.getItem(key));
    if (record?.defaults === defaultsOf(panel)) return record.values;
    storage.removeItem(key);
  } catch {}
  return null;
}

function store(storage, key, panel) {
  try { storage.setItem(key, JSON.stringify({ defaults: defaultsOf(panel), values: read(panel) })); return true; } catch { return false; }
}

// Set controls to new values, firing the same events a person would, so the page's own handlers apply them.
// valueOf(input) gives the value to set, or undefined to leave that control alone.
function apply(panel, valueOf) {
  for (const input of controls(panel)) {
    const value = valueOf(input);
    if (value === undefined) continue;
    if (['range', 'color', 'text', 'textarea'].includes(input.type)) {
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
  try { localStorage.removeItem(oldSavedKey); } catch {}
  const state = load(sessionStorage, tabKey, panel);
  if (state) apply(panel, input => state[input.name]);

  const keep = () => store(sessionStorage, tabKey, panel);
  panel.addEventListener('input', keep);
  panel.addEventListener('change', keep);
}

