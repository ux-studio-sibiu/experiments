gsap.registerPlugin(ScrollTrigger);

/* The brain teaser, told by the scroll on one pinned screen.

   The whole story is ONE timeline on ONE scrubbed ScrollTrigger; each scene is a child timeline stretched to its
   own share of the scroll (SCENES). One timeline renders its frames in order, so scrolling back - however fast -
   always lands on a frame that played forwards. (Separate scrubbed timelines per scene each caught up on their
   own and could undo a shared element - the sentence's letters - in the wrong order.)

   Two rules keep it right through a resize, which re-measures everything (invalidateOnRefresh):
   - every tween is a fromTo: a to() would re-read its start from wherever the screen is at that moment;
   - when a later tween takes an element over from an earlier one, it starts from the earlier one's end and has
     immediateRender: false, so it doesn't overwrite the earlier one's start the moment it is built. */

// The puzzle, in km and km/h.
const DISTANCE = 110;
const TRAIN_SPEED = 110;
const BEE_SPEED = 270;
const ARRIVAL = DISTANCE / TRAIN_SPEED;   // h, the trip's length

const opening = document.querySelector('.nsc-teaser-opening');
const screen = opening.querySelector('.screen');
const $ = (selector) => opening.querySelector(selector);

// Split a line into letters, kept in their words so it still wraps between words. An element inside the line
// (an icon standing in for a word) becomes one "letter" of its own. The full sentence stays readable to
// assistive tech on the line itself - its data-label if it has one, else its text.
function splitLetters(line) {
  line.setAttribute('aria-label', line.dataset.label || line.textContent.trim());
  const word = (inner) => `<span class="word" aria-hidden="true">${inner}</span>`;
  line.innerHTML = [...line.childNodes].map((node) => node.nodeType === Node.TEXT_NODE
    ? node.textContent.split(/(\s+)/).map((part) => (/^\s*$/.test(part)
      ? (part ? ' ' : '')
      : word([...part].map((c) => `<span class="letter">${c}</span>`).join('')))).join('')
    : word(`<span class="letter">${node.outerHTML}</span>`)).join('');
  return [...line.querySelectorAll('.letter')];
}

const headline = $('.headline');
const setupLine = $('.setup');
const subline = $('.subline');
const distance = $('.distance');
const speed = { train: $('.speed.train'), bee: $('.speed.bee') };

// The figures in the text come from the puzzle above, so they only ever need changing there - before the
// lines are split into letters.
subline.textContent = `${DISTANCE} km apart`;
distance.setAttribute('aria-label', `${DISTANCE} km apart`);
for (const [who, kmh, verb] of [['train', TRAIN_SPEED, 'travels'], ['bee', BEE_SPEED, 'flies']]) {
  speed[who].querySelector('.shape').textContent = `${kmh} km/h`;
  speed[who].setAttribute('aria-label', `The ${who} ${verb} at ${kmh} km/h`);
}

const setupLetters = splitLetters(setupLine);
const subLetters = splitLetters(subline);
const travellerLetters = splitLetters($('.travellers'));
const glyphLetters = travellerLetters.filter((l) => l.querySelector('.glyph'));   // [train, bee]
const textLetters = travellerLetters.filter((l) => !l.querySelector('.glyph'));
const glyph = { train: glyphLetters[0].querySelector('.glyph'), bee: glyphLetters[1].querySelector('.glyph') };
// the lines that stand above the bee and the train, one after another
const rules = $('.rules');          // scene 3: how the bee flies
const caption = $('.caption');      // scene 4: "Like below:"
const question = $('.question');    // scene 5
const rulesLetters = splitLetters($('.rules .text'));
const captionLetters = splitLetters($('.caption .text'));
const [cityA, cityB] = opening.querySelectorAll('.city');
const km = $('.distance .km');
const actor = { train: $('.actor.train'), bee: $('.actor.bee') };
const beeImg = actor.bee.querySelector('img');

/* ---- layout: where things go, measured on every refresh ---- */

// The cities settle in the bottom corners, CORNER_X in from the sides and CORNER_Y up from the bottom; as the x / y
// each travels from its place in the layout (offsets, which transforms don't change).
const CORNER_X = () => innerWidth * 0.05;
const CORNER_Y = () => innerHeight * 0.08;
const CITY_GAP = 24;   // px between a city and the end of the distance line
const toCorner = (city, side) => ({
  x: () => (side === 'left' ? CORNER_X() : screen.clientWidth - CORNER_X() - city.offsetWidth) - city.offsetLeft,
  y: () => screen.clientHeight - CORNER_Y() - city.offsetHeight - city.offsetTop,
});

// The train and the bee land on two rows: the train's centre at TRAIN_ROW (a share of the screen's height), the
// bee straight above it with ROW_GAP between them. The pair and their arrows are centred across the screen as
// one group: icon, gap, arrow.
const TRAIN_ROW = 0.53;
const ROW_GAP = 10;     // px between the bee's bottom and the train's top
const SPEED_GAP = 28;   // px between an icon and its arrow
const ABOVE_GAP = 40;   // px between the lines above (explanation, lead-in, question) and the bee

// The x / y / scale that put an actor's centre on its icon in the sentence, at that icon's size - which it
// keeps: it moves, it doesn't grow. Measured from the icon itself, not its letter box (a whole line tall); the
// icons are square, so the bee's quarter turn leaves its box the same.
function onGlyph(who) {
  const g = glyph[who].getBoundingClientRect(), s = screen.getBoundingClientRect(), size = actor[who].offsetWidth;
  return { x: g.left + g.width / 2 - s.left - size / 2, y: g.top + g.height / 2 - s.top - size / 2, scale: g.height / size, icon: g.height };
}
// From the layout's measurements (metrics, below), so it is only ever called once layout() has run.
function landing(who) {
  const icon = metrics.icon[who], size = metrics.box[who];
  const left = (screen.clientWidth - (icon + SPEED_GAP + Math.max(speed.train.offsetWidth, speed.bee.offsetWidth))) / 2;
  const trainCy = screen.clientHeight * TRAIN_ROW;
  const cx = left + icon / 2, cy = who === 'train' ? trainCy : trainCy - (metrics.icon.train + icon) / 2 - ROW_GAP;
  return { x: cx - size / 2, y: cy - size / 2, arrowX: left + icon + SPEED_GAP, cy };
}

// Measured once per layout and read on every frame of the trip (re-measuring there forced a layout per frame):
// the icons' size in the sentence, the actors' box, and the distance line's place.
const metrics = { icon: { train: 0, bee: 0 }, box: { train: 0, bee: 0 }, line: { left: 0, width: 0, ground: 0 } };

// The pieces that only sit in place (no motion of their own to measure): the distance line, the two arrows, and
// the lines above the bee.
function layout() {
  for (const who of ['train', 'bee']) {
    metrics.icon[who] = glyph[who].getBoundingClientRect().height;
    metrics.box[who] = actor[who].offsetWidth;
  }
  const ground = screen.clientHeight - CORNER_Y() - cityA.offsetHeight + cityA.querySelector('img').offsetHeight;
  const left = CORNER_X() + cityA.offsetWidth + CITY_GAP;
  const right = screen.clientWidth - CORNER_X() - cityB.offsetWidth - CITY_GAP;
  metrics.line = { left, width: Math.max(0, right - left), ground };
  gsap.set(distance, { x: left, y: ground, width: metrics.line.width });
  for (const who of ['train', 'bee']) {
    const { arrowX, cy } = landing(who);
    gsap.set(speed[who], { x: Math.round(arrowX), y: Math.round(cy - speed[who].offsetHeight / 2) });   // whole pixels: crisp edges
  }
  // the explanation, then the lead-in and the question in its place, end ABOVE_GAP above the top of the bee
  const beeTop = landing('bee').cy - metrics.icon.bee / 2;
  gsap.set([rules, caption, question], { height: Math.max(0, beeTop - ABOVE_GAP) });
}
ScrollTrigger.addEventListener('refreshInit', layout);
layout();

// The km under the distance line counts up with it. Also shown after every refresh: a tween's onUpdate doesn't
// fire when it is only re-rendered in place.
const counter = { km: 0 };
const showKm = () => { km.textContent = Math.round(counter.km); };
ScrollTrigger.addEventListener('refresh', showKm);

const typing = (letters, stagger) => [letters, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.15, stagger }];
const fadeOut = (targets, duration, more = {}) => [targets, { autoAlpha: 1 }, { autoAlpha: 0, duration, ...more }];
const takeOver = { immediateRender: false };

/* ---- scene 1: the setup ----
   The title fades; the setup line types itself out in its place; city A and city B zoom in below it, one after
   the other, then move to the bottom corners, and as the distance line draws between them the second line types
   itself out below the first. */
function setup() {
  return gsap.timeline({ defaults: { ease: 'none' } })
    .addLabel('title')
    .fromTo(...fadeOut(headline, 1))
    .addLabel('typing', '-=0.2')
    .fromTo(...typing(setupLetters, 0.06), 'typing')
    .addLabel('city A', '+=0.3')
    .fromTo(cityA, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1, ease: 'back.out(1.6)' }, 'city A')
    .addLabel('city B', '+=0.15')
    .fromTo(cityB, { scale: 0, autoAlpha: 0 }, { scale: 1, autoAlpha: 1, duration: 1, ease: 'back.out(1.6)' }, 'city B')
    .addLabel('hold')
    .to({}, { duration: 0.5 })   // a beat on the two cities
    .addLabel('to corners')
    .fromTo(cityA, { x: 0, y: 0 }, { ...toCorner(cityA, 'left'), duration: 1.2, ease: 'power2.inOut' }, 'to corners')
    .fromTo(cityB, { x: 0, y: 0 }, { ...toCorner(cityB, 'right'), duration: 1.2, ease: 'power2.inOut' }, 'to corners')
    .addLabel('distance')
    .fromTo($('.distance .rule'), { scaleX: 0 }, { scaleX: 1, duration: 0.7, ease: 'power2.inOut' }, 'distance')
    .fromTo(counter, { km: 0 }, { km: DISTANCE, duration: 0.7, ease: 'power2.inOut', onUpdate: showKm }, 'distance')
    .fromTo($('.distance .amount'), { autoAlpha: 0, y: -8 }, { autoAlpha: 1, y: 0, duration: 0.3 }, 'distance')
    .fromTo(...typing(subLetters, 0.06), 'distance')
    .addLabel('end hold')
    .to({}, { duration: 0.8 });
}

/* ---- scene 2: the travellers ----
   The two centred lines fade, and in their place the next sentence types itself out the same way, the train
   and the bee appearing as icons where their words would be. */
function travellers() {
  return gsap.timeline({ defaults: { ease: 'none' } })
    .addLabel('fade text')
    .fromTo(...fadeOut([setupLine, subline], 0.6))
    .addLabel('typing', '-=0.1')
    .fromTo(...typing(travellerLetters, 0.05), 'typing')
    .addLabel('hold')
    .to({}, { duration: 0.6 });
}

/* ---- scene 3: the speeds ----
   The rest of the sentence fades and the two icons lift out of it: the train and the bee take over from them
   at the same place and size, then move in straight lines at a steady speed to two rows in the middle of the
   screen, the bee above the train. As an arrow draws out from each - at a pace proportional to the speed on
   it: both are the same length, so the faster one takes less time (the fastest DRAW_FASTEST), at a steady pace
   so the ratio holds all the way - the explanation of how the bee flies types itself out above the two. */
const DRAW_FASTEST = 0.3;
function speeds() {
  const fly = (who) => [actor[who],
    { x: () => onGlyph(who).x, y: () => onGlyph(who).y, scale: () => onGlyph(who).scale },
    { x: () => landing(who).x, y: () => landing(who).y, scale: () => onGlyph(who).scale, duration: 0.6 }];
  const draw = (who, kmh) => [speed[who], { clipPath: 'inset(0 100% 0 0)', autoAlpha: 1 },
    { clipPath: 'inset(0 0% 0 0)', autoAlpha: 1, duration: DRAW_FASTEST * Math.max(TRAIN_SPEED, BEE_SPEED) / kmh }];

  // Hidden by GSAP itself, not only by the stylesheet: a take-over tween scrolled back past its start restores
  // what it found before it first ran, and read from the CSS that was "opacity 1" - visible.
  gsap.set([actor.train, actor.bee], { autoAlpha: 0, transformOrigin: '50% 50%' });
  return gsap.timeline({ defaults: { ease: 'none' } })
    .addLabel('fade text')
    .fromTo(...fadeOut(textLetters, 0.5, takeOver), 'fade text')                       // typed in by scene 2
    // The actors take over from the icons in the sentence, unseen: same place, same size. Each fades in over
    // its icon, then the icon fades out under it, so there is never a frame with neither or a dip between them.
    .fromTo([actor.train, actor.bee], { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ...takeOver }, 'fade text')
    .fromTo(...fadeOut(glyphLetters, 0.1, takeOver), 'fade text+=0.1')
    .addLabel('move', '-=0.2')
    .fromTo(...fly('train'), 'move')
    .fromTo(...fly('bee'), 'move+=0.075')
    .addLabel('speeds')
    .fromTo(...draw('train', TRAIN_SPEED), 'speeds')   // both start together
    .fromTo(...draw('bee', BEE_SPEED), 'speeds')
    // and with them, above the two, how the bee flies types itself out
    .fromTo(...typing(rulesLetters, 0.015), 'speeds')
    .addLabel('hold')
    .to({}, { duration: 0.8 });
}

/* ---- the puzzle's motion (scene 4) ----
   Where the bee is at time t (h): it starts on the train's nose and flies at BEE_SPEED, turning at city B and
   at the train, so its legs shrink geometrically. Walk the legs to the one t falls in. Returns its position
   (km from A), which way it is flying (1 towards B, -1 back), and how many times it has turned.

   The photo-finish: the legs soon get shorter than the bee is long, and the turns stop reading as turns. So the
   first time the bee meets the train with less than PHOTO_FINISH_KM to go, it stays on the train's nose from
   then on, facing B, and the two cross the line together. (The answer, BEE_SPEED x ARRIVAL, doesn't change.) */
const PHOTO_FINISH_KM = 10;
function beeAt(t) {
  let time = 0, x = 0, dir = 1, turns = 0;
  for (let leg = 0; leg < 200; leg++) {
    const trainX = TRAIN_SPEED * time;
    // on the train's nose, close to B: ride it in
    if (dir > 0 && leg > 0 && DISTANCE - x < PHOTO_FINISH_KM) return { x: TRAIN_SPEED * Math.min(t, ARRIVAL), dir, turns, photoFinish: time };
    // time to the next turn: to city B, or back to meet the oncoming train
    const legTime = dir > 0 ? (DISTANCE - x) / BEE_SPEED : (x - trainX) / (BEE_SPEED + TRAIN_SPEED);
    if (time + legTime >= t || legTime < 1e-9) return { x: x + dir * BEE_SPEED * (t - time), dir, turns };
    time += legTime;
    x += dir * BEE_SPEED * legTime;
    dir = -dir;
    turns++;
  }
  return { x: DISTANCE, dir, turns };
}
// When the photo-finish begins, in trip hours: the time of that last meeting.
const PHOTO_FINISH_AT = beeAt(ARRIVAL).photoFinish ?? ARRIVAL;

/* ---- scene 4: the trip ----
   The explanation and the arrows clear, "Like below:" types itself out in their place, and the train and the
   bee glide to city A - the train onto the distance line, which is now its track, its nose on km 0; the bee,
   shrinking to BEE_SIZE, just above it - and then travel. The train runs to city B at a steady pace; the bee
   shuttles between city B and the train's nose (beeAt above), turning to face the way it flies, until the
   photo-finish. Both are placed from one clock, so the bee's zigzag is exact at any scroll position. */
const BEE_SIZE = 0.7;   // the bee on the trip, as a share of its size in the sentence - it shrinks on its way to the start
const BEE_LIFT = 0.15;  // the bee's gap above the train, in train heights
const trip = { t: 0 };

// The track: the distance line, from one train length in from its left end (km 0 - so the whole train starts on
// the track, clear of city A) to its right end (km DISTANCE, city B).
// The km mark's x on the screen. All from the layout's measurements: this runs on every frame of the trip.
function kmAt(kmFromA) {
  const { left, width } = metrics.line, start = left + metrics.icon.train;
  return start + (kmFromA / DISTANCE) * (left + width - start);
}
// The actor's x / y for its icon's centre at (cx, cy).
const centredAt = (who, cx, cy) => ({ x: cx - metrics.box[who] / 2, y: cy - metrics.box[who] / 2 });
// Where each one is at trip time t (h), each by its leading edge on its km mark: the train's nose, wheels on
// the track; the bee's head, BEE_LIFT above the train. So the two start on one line, and when the bee turns it
// swings round its head - which stays on the turning point.
function onTrip(t) {
  const { ground } = metrics.line, icon = metrics.icon.train, beeIcon = metrics.icon.bee * BEE_SIZE;
  const bee = beeAt(t);
  return {
    train: centredAt('train', kmAt(TRAIN_SPEED * t) - icon / 2, ground - icon / 2),
    bee: { ...centredAt('bee', kmAt(bee.x) - bee.dir * beeIcon / 2, ground - icon - BEE_LIFT * icon - beeIcon / 2), dir: bee.dir },
  };
}
function placeTrip() {
  const p = onTrip(trip.t);
  gsap.set(actor.train, { x: p.train.x, y: p.train.y });
  gsap.set(actor.bee, { x: p.bee.x, y: p.bee.y });
  gsap.set(beeImg, { rotation: p.bee.dir > 0 ? 90 : -90 });   // head the way it flies
}

let tripTween;
function tripScene() {
  gsap.set(beeImg, { rotation: 90 });   // the stylesheet's quarter turn, now in GSAP's hands
  const TRIP = 4;   // the trip's length in this scene's time
  tripTween = gsap.fromTo(trip, { t: 0 }, { t: ARRIVAL, duration: TRIP, ease: 'none', onUpdate: placeTrip, ...takeOver });
  // on the way to the start line the bee also shrinks to BEE_SIZE; the train keeps its size
  const sizeOnTrip = (who) => onGlyph(who).scale * (who === 'bee' ? BEE_SIZE : 1);
  // Same start, same curve, slightly different pace - the bee, the faster of the two, settles a little first -
  // so they travel together without moving as one piece.
  const TO_START = { train: 0.9, bee: 0.7 };
  const toStart = (who) => [actor[who],
    { x: () => landing(who).x, y: () => landing(who).y, scale: () => onGlyph(who).scale },
    { x: () => onTrip(0)[who].x, y: () => onTrip(0)[who].y, scale: () => sizeOnTrip(who), duration: TO_START[who], ease: 'power2.inOut', ...takeOver }];
  return gsap.timeline({ defaults: { ease: 'none' } })
    .addLabel('clear')
    .fromTo(...fadeOut(rules, 0.5), 'clear')
    .fromTo(...fadeOut([speed.train, speed.bee], 0.5, takeOver), 'clear')   // drawn in by scene 3
    .addLabel('to start', '-=0.2')
    .fromTo(...toStart('train'), 'to start')
    .fromTo(...toStart('bee'), 'to start')   // starting together: offset, they looked disjointed
    // once the explanation has completely gone, the lead-in types itself out in its place, and stays
    .fromTo(...typing(captionLetters, 0.04), 'clear+=0.5')
    .addLabel('at start')
    .to({}, { duration: 0.35 })   // a pause on the start line: about 300px of scroll on a 1000px-tall window
    .addLabel('trip')
    .add(tripTween, 'trip')
    .addLabel('photo-finish', `trip+=${(TRIP * PHOTO_FINISH_AT) / ARRIVAL}`)   // the bee rides the train in from here
    .addLabel('arrived', `trip+=${TRIP}`)
    .to({}, { duration: 0.6 });
}
// After a refresh, re-place them if the trip has begun: its onUpdate doesn't fire when it is only re-rendered.
ScrollTrigger.addEventListener('refresh', () => { if (tripTween && tripTween.progress() > 0) placeTrip(); });

/* ---- scene 5: the question ----
   A pause on the finish, then everything still on the screen fades together, and the question fades in, alone.
   This scene is given as many screen heights as it has time, so one unit here is one screen of scroll: the
   pause's 0.3 is about 300px on a 1000px-tall window. */
function questionScene() {
  const leaving = [cityA, cityB, actor.train, actor.bee];   // shown by earlier scenes
  return gsap.timeline({ defaults: { ease: 'none' } })
    .addLabel('pause')
    .to({}, { duration: 0.3 })
    .addLabel('fade out')
    .fromTo(...fadeOut(leaving, 0.5, takeOver), 'fade out')
    .fromTo(...fadeOut([distance, caption], 0.5), 'fade out')
    .addLabel('question')
    .fromTo(question, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.6 }, 'question')
    .addLabel('end hold')
    .to({}, { duration: 0.5 });
}

/* ---- the story: the scenes in order, each given its share of the scroll in screen heights ---- */
const SCENES = [
  { name: 'opening', screens: 4.2, build: setup },
  { name: 'travellers', screens: 2.6, build: travellers },
  { name: 'speeds', screens: 5.3, build: speeds },   // with the explanation typed in alongside the arrows
  { name: 'trip', screens: 5, build: tripScene },
  { name: 'question', screens: 1.9, build: questionScene },   // = its time, so the 0.3 pause is 0.3 screens
];
const totalScreens = SCENES.reduce((sum, s) => sum + s.screens, 0);

// One unit of story time is one screen height of scroll; each scene is stretched (or squeezed) to its share.
const story = gsap.timeline({
  scrollTrigger: {
    trigger: opening,
    start: 'top top',
    end: () => `+=${totalScreens * innerHeight}`,
    pin: true,
    scrub: 0.5,
    invalidateOnRefresh: true,
  },
});
let at = 0;
for (const scene of SCENES) {
  scene.timeline = scene.build();
  scene.timeline.duration(scene.screens);
  scene.start = at;
  story.add(scene.timeline, at);
  at += scene.screens;
}

/* ---- reference bar (a working aid, for pointing at moments in the story) ----
   Hidden; press R to show it. Bottom-left: the scene, how far through it you are, the step, and the page scroll.
   Click it to copy the reference. Shown or not, the address keeps it as #s<scene>-<percent>, and opening that
   address jumps back to the same moment. Delete this block, and .scroll-ref in style.css, when the story is done. */
const ref = document.createElement('button');
ref.type = 'button';
ref.className = 'scroll-ref';
ref.title = 'Click to copy this reference. R hides it.';
ref.hidden = true;
document.body.appendChild(ref);

const st = story.scrollTrigger;
const scrollAt = (storyTime) => st.start + (storyTime / totalScreens) * (st.end - st.start);

function whereAmI() {
  const y = Math.round(scrollY);
  if (y < st.start) return { text: `before s1 · scroll ${y}px`, hash: `#y${y}` };
  if (y > st.end) return { text: `after s${SCENES.length} · scroll ${y}px`, hash: `#y${y}` };
  // where the scroll is, not where the scrub has caught up to
  const time = st.progress * totalScreens;
  const i = Math.max(0, SCENES.findLastIndex((s) => time >= s.start));
  const scene = SCENES[i];
  const pct = Math.round(Math.min(1, (time - scene.start) / scene.screens) * 100);
  const step = scene.timeline.currentLabel() || Object.keys(scene.timeline.labels)[0];
  return { text: `s${i + 1} ${scene.name} · ${pct}% · ${step} · scroll ${y}px`, hash: `#s${i + 1}-${pct}` };
}

// Trying out blend modes for the content on the paper (see .screen in style.css): B cycles them, and the bar
// says which one is on. Keep the one you like as --blend in the stylesheet.
const BLENDS = ['multiply', 'darken', 'color-burn', 'luminosity', 'normal'];
let blend = 0;

let lastText = '';
gsap.ticker.add(() => {
  const { text, hash } = whereAmI();
  const shown = `${text} · blend ${BLENDS[blend]} (B)`;
  if (shown === lastText) return;
  lastText = shown;
  ref.textContent = shown;
  history.replaceState(null, '', hash);
});

ref.addEventListener('click', () => {
  navigator.clipboard?.writeText(lastText).then(() => {
    ref.classList.add('is-copied');
    setTimeout(() => ref.classList.remove('is-copied'), 900);
  });
});
addEventListener('keydown', (e) => {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  if (e.target.closest?.('input, textarea, select, [contenteditable]')) return;   // typing in a panel's field
  const key = e.key.toLowerCase();
  if (key === 'r') ref.hidden = !ref.hidden;
  if (key === 'b') {
    blend = (blend + 1) % BLENDS.length;
    screen.style.setProperty('--blend', BLENDS[blend]);
  }
});

// #s2-40 opens 40% into scene 2; #y1200 opens at 1200px of scroll.
function jumpTo(hash) {
  const m = hash.match(/^#s(\d+)-(\d+)$/), y = hash.match(/^#y(\d+)$/);
  const scene = m && SCENES[+m[1] - 1];
  if (scene) scrollTo(0, scrollAt(scene.start + (+m[2] / 100) * scene.screens));
  else if (y) scrollTo(0, +y[1]);
}
// Nunito arrives after the first layout: re-measure everything placed from the text - the icons in the
// sentences, the explanation's height, the arrows' width - once it has loaded.
document.fonts?.ready.then(() => ScrollTrigger.refresh());
// And whenever the screen itself changes size - including from nothing, when the page first loads in a frame that
// has no size yet (the motion index's preview iframes) - not only on a window resize.
let lastSize = '';
new ResizeObserver(([entry]) => {
  const size = `${Math.round(entry.contentRect.width)}x${Math.round(entry.contentRect.height)}`;
  if (size !== lastSize && lastSize) ScrollTrigger.refresh();
  lastSize = size;
}).observe(screen);

history.scrollRestoration = 'manual';
addEventListener('load', () => { ScrollTrigger.refresh(); jumpTo(location.hash); });
