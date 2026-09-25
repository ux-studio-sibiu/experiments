/* text — the sample copy.
   Fixed word banks sliced deterministically, so a given length always yields
   the same words: only the dice change the text, never a re-render. */

/* ============================ sample text generation ============================ */
// Fixed, themed word banks. Text is sliced deterministically (no randomness) so
// dragging the length slider extends/trims the SAME copy instead of reshuffling.
const TITLE = ('randomize studio your portfolio cover before anyone else gets the chance to '
  + 'judge it by its typeface').split(' ');
const SUB = ('a playground for pairing google fonts over a cover image roll the dice nudge the '
  + 'type drop in a photo and copy the css when it clicks').split(' ');
const PROSE = [
  'this is the green room where type tries on outfits before the big show',
  'you pick a face for the title a quieter one for the body and the dice handle the awkward first dates',
  'it was built for portfolio covers case study headers album sleeves and the hero section you will secretly redesign at midnight',
  'every font streams straight from google fonts so you can flirt with playfair commit to inter and never install a thing',
  'push the scale loosen the tracking and dim the photo behind the words',
  'and when a pairing finally clicks and trust me it will you copy the css and walk away as though you planned the whole performance',
];
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const take = (arr, n) => { const o = []; for (let i = 0; i < n; i++) o.push(arr[i % arr.length]); return o; };
const phrase = (arr, n) => cap(take(arr, n).join(' '));               // heading / subheading (no period)
function paragraph(n) {                       // body — whole sentences up to ~n words (cycles if needed)
  const parts = []; let words = 0, i = 0;
  while (words < n && i < 240) {
    const s = PROSE[i % PROSE.length];
    parts.push(cap(s) + '.');
    words += s.split(' ').length;
    i++;
  }
  return parts.join(' ');
}
function genText(r) {
  if (r === 'heading') return phrase(TITLE, state.heading.amount);
  if (r === 'subheading') return phrase(SUB, state.subheading.amount);
  return paragraph(state.body.amount);
}
const setText = (r) => { els[r].textContent = genText(r); };

// Fixed cover copy used by the global Randomize button and on page load only.
// (Per-section dice still pulls varied copy from the word banks above.)
const COVER = {
  heading: { text: 'Randomize Studio',                      words: 2 },
  sub:     { text: 'A playground for exploring typography', words: 5 },
};
