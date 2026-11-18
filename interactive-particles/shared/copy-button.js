// A button that copies text made on demand, and answers by flashing inverted for a moment, as the studio's
// copy buttons do (static-background's Copy settings).

export function bindCopyButton(button, getText) {
  let timer = 0;
  button.addEventListener('click', async () => {
    try {
      await navigator.clipboard.writeText(getText());
    } catch {
      return; // no clipboard access (a non-secure origin, or permission refused): nothing to flash
    }
    button.classList.add('is-copied');
    clearTimeout(timer);
    timer = setTimeout(() => button.classList.remove('is-copied'), 900);
  });
}
