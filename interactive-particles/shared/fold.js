// Every section of a panel folds open and shut, as the studio's sub-layers do (panel.css: .grp.collapsed hides the
// section's .grp-body and turns its .chev). The chevron sits first in the header, on the left; the whole header is the
// toggle, except the controls riding in it (a mode switch's knob, a dice, a button), which keep their own clicks: a
// mode switch's name folds like any title, its knob alone flips it. The
// chevron takes the keyboard (Enter / Space). Which sections are shut is kept for the tab.
//
//   import { foldSections } from './fold.js';
//   foldSections(panel);
//
// Markup: <div class="grp" data-fold="motion" data-fold-shut><h3><span class="chev"></span>Motion</h3>
//         <div class="grp-body">...</div></div>
// data-fold names the section (for the memory); data-fold-shut keeps it shut until it is opened.

export function foldSections(panel, { key = `fold:${location.pathname}` } = {}) {
  let saved = {};
  try { saved = JSON.parse(sessionStorage.getItem(key)) ?? {}; } catch {}
  const groups = [...panel.querySelectorAll('.grp')].filter(g => g.querySelector(':scope > h3 > .chev'));
  const keep = () => {
    try { sessionStorage.setItem(key, JSON.stringify(Object.fromEntries(groups.map(g => [g.dataset.fold, g.classList.contains('collapsed')])))); } catch {}
  };

  groups.forEach((group, i) => {
    group.dataset.fold ||= String(i);
    const header = group.querySelector(':scope > h3');
    const chev = header.querySelector(':scope > .chev');
    // its name for screen readers: data-fold-name, else data-fold (the header's text can hold a switch's two names)
    const name = group.dataset.foldName || group.dataset.fold;
    const set = shut => {
      group.classList.toggle('collapsed', shut);
      chev.setAttribute('aria-expanded', String(!shut));
    };
    chev.tabIndex = 0;
    chev.setAttribute('role', 'button');
    chev.setAttribute('aria-label', `Fold ${name}`);
    set(group.dataset.fold in saved ? saved[group.dataset.fold] : group.hasAttribute('data-fold-shut'));

    const toggle = () => { set(!group.classList.contains('collapsed')); keep(); };
    header.addEventListener('click', e => {
      // a mode switch's name is the section's title: it folds, and only the knob flips the switch
      if (e.target.closest('.toggle-label')) { e.preventDefault(); toggle(); return; }
      if (e.target.closest('input, label, button, select, a, summary')) return; // a control in the header
      toggle();
    });
    chev.addEventListener('keydown', e => {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
      toggle();
    });
  });
}
