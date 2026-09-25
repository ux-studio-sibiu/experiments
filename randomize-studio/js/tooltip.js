/* tooltip — every title attribute, shown as the portfolio's cursor-card.

   The native tooltip cannot be styled, cannot be positioned, and waits a second
   before it says anything; in a panel made almost entirely of unlabelled icon
   buttons that second is most of the time you spend looking for a control. This
   replaces it with the card from the portfolio (app/components/cursor-card):
   a box at the pointer that follows it until it leaves whatever opened it.

   Nothing else in the app has to know. It reads title attributes wherever they
   are - written in index.html, set from panel.js as a layer is hidden, put on a
   scene row as the list is rebuilt - and it does it by delegation, so markup
   that appears later is covered without being registered anywhere.

   A title has to come OFF the element while its card is up, or the browser
   draws its own tooltip over ours a second later. It goes back on at close, so
   the attribute is the single source of the text and nothing has to be kept in
   step with it. A tip with line breaks in it reads as a heading and the rest. */

const Tip = (() => {
  // How far from the pointer the card sits, and how far it keeps off the edges
  // of the screen when the pointer runs into a corner. Both from cursor-card.
  const OFFSET = 18;
  const MARGIN = 10;

  let card = null;      // the node, made on open and dropped on close
  let host = null;      // the element whose title is on screen
  let text = '';        // that title, held while it is off the element
  let blocked = null;   // pressed with the card up: no card again until we leave

  function place(x, y) {
    // Never off the bottom or the right: past those it sits back from the
    // pointer instead of in front of it.
    const left = Math.min(x + OFFSET, innerWidth - card.offsetWidth - MARGIN);
    const top = Math.min(y + OFFSET, innerHeight - card.offsetHeight - MARGIN);
    card.style.transform = `translate(${Math.round(Math.max(MARGIN, left))}px, ${Math.round(Math.max(MARGIN, top))}px)`;
  }

  function open(el, x, y) {
    if (!el || el === blocked) return;
    const tip = el.getAttribute('title') || '';
    // An empty title is how a child says "nothing here" over a parent that has
    // something to say, and the browser honours that. So do we.
    if (!tip.trim()) return;
    host = el;
    text = tip;
    el.removeAttribute('title');

    const [head, ...rest] = tip.split('\n');
    const body = rest.join('\n').trim();
    // Built rather than assigned: a tip can carry a scene's name, and a name
    // cannot be allowed to bring markup with it.
    card = document.createElement('div');
    card.className = 'nsc-tipcard';
    // Hidden from assistive tech: it is the title attribute, which is already
    // announced, and it exists only for a pointer.
    card.setAttribute('aria-hidden', 'true');
    const title = document.createElement('p');
    title.className = 'card-title';
    title.textContent = head.trim();
    card.append(title);
    if (body) {
      const summary = document.createElement('p');
      summary.className = 'card-summary';
      summary.textContent = body;
      card.append(summary);
    }
    // To <body>, not beside the control: the panel scrolls and clips, and a
    // card drawn inside it would be cut off at the edge of the section.
    document.body.append(card);
    place(x, y);
  }

  function close() {
    // Back exactly as it was - unless something wrote a new title while ours
    // was off the element, in which case the new one is the true one.
    if (host && text && !host.hasAttribute('title')) host.setAttribute('title', text);
    host = null;
    text = '';
    if (card) { card.remove(); card = null; }
  }

  // Mouse only: on a touch screen the card would come up under the finger that
  // just pressed the button it describes.
  const mouse = (e) => e.pointerType === 'mouse';
  const titled = (node) => (node && node.closest) ? node.closest('[title]') : null;

  document.addEventListener('pointerover', (e) => {
    if (!mouse(e)) return;
    // Still inside the one on screen. Without this, moving onto a child of the
    // host finds the host's own parent instead - the host has no title on it
    // while its card is up - and the card would swap to the section heading.
    if (host && host.contains(e.target)) return;
    if (host) close();
    open(titled(e.target), e.clientX, e.clientY);
  });

  document.addEventListener('pointerout', (e) => {
    if (!host) return;
    if (e.relatedTarget && host.contains(e.relatedTarget)) return;  // onto a child
    close();
  });

  document.addEventListener('pointermove', (e) => {
    if (blocked && !blocked.contains(e.target)) blocked = null;
    if (host) {
      // A panel that rebuilds itself under the pointer - which is what
      // randomizing a layer does - takes the host away without a pointerout,
      // and the card would sit there describing something that is gone.
      if (!host.isConnected) close();
      else { place(e.clientX, e.clientY); return; }
    }
    // Comes back after a press or a scroll has closed it, which is otherwise
    // impossible without leaving the control and returning: the pointer is
    // already inside, so there is no second pointerover to wait for.
    if (mouse(e)) open(titled(e.target), e.clientX, e.clientY);
  }, { passive: true });

  // Pressing a control does something, and what it does is usually the thing
  // the card was explaining. It stays down until the pointer leaves.
  document.addEventListener('pointerdown', (e) => {
    blocked = host || titled(e.target);
    close();
  }, true);

  // Scrolling takes the control out from under the pointer, and whether that
  // produces a pointerout is up to the browser: some re-hit-test as the page
  // moves, some wait for the next mouse move. Either way the card is
  // describing something that is no longer there.
  // Capturing, because scroll does not bubble and the thing that scrolls here
  // is the panel rather than the page.
  document.addEventListener('scroll', close, { capture: true, passive: true });

  return { close };
})();
