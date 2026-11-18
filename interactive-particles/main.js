// Interactive particles: the page. The effect itself is the module (interactive-particles.js); this page is the
// panel around it: controls, upload, badge, persistence, and the copy-prompt button.
import { createInteractiveParticles, SHAPES } from './interactive-particles.js';
import { saveImage, loadSavedImage, clearSavedImage } from './shared/saved-image.js';
import { restoreUi, bindSaveButton, bindResetButton } from './shared/saved-ui.js';
import { bindCopyButton } from './shared/copy-button.js';
import { fineTune } from './shared/fine-tune.js';

const DEFAULT_IMAGE = 'img/walter-gropius-1919.jpg'; // public domain, Wikimedia Commons (see README)

const stage = document.querySelector('.stage');
const badge = document.querySelector('.stage-badge');
const panel = document.querySelector('.panel');
const field = name => document.querySelector(`[name="${name}"]`);

// STEP 05 -> the particle count, coloured by a rough performance budget; hover the badge for the numbers.
// Each particle is 4 vertices running two noise calls and two texture reads, and overlapping particles are all
// blended, so cost grows with the count and with particle size. The original's ceiling was 320 x 180 = 57,600.
const BUDGET = [
  [150000, 'is-heavy', 'red: expect dropped frames on most non-gaming hardware'],
  [100000, 'is-high', 'orange: integrated laptop GPUs may stutter, especially full-screen with big particles'],
  [50000, 'is-busy', 'yellow: fine on laptops; older or low-end phones may drop frames']
];
const BUDGET_GUIDE = 'Rough performance budget: up to 50,000 runs smoothly almost anywhere, phones included; 50,000 to 100,000 yellow; 100,000 to 150,000 orange; over 150,000 red. Bigger particles cost more too: every overlap is blended.';

function showCount({ width, height, count }) {
  const tier = BUDGET.find(([limit]) => count > limit);
  const number = document.createElement('span');
  number.className = tier ? `count ${tier[1]}` : 'count';
  number.textContent = count.toLocaleString();
  badge.replaceChildren(number, ` of ${(width * height).toLocaleString()} pixels`);
  badge.title = `${count.toLocaleString()} particles. Now: ${tier ? tier[2] : 'within budget'}.\n${BUDGET_GUIDE}`;
}

// one call: the module makes the canvas, the loop, the pointer handling and the transitions
// The page's own look, where it differs from the module's defaults. It matches the panel's HTML values, which are
// also what reset goes back to.
const PAGE_DEFAULTS = {
  invert: true, background: '#ffffff', gridSize: 115, threshold: 64, brightness: -15, contrast: 0.9, size: 1.7, variation: 0.55,
  random: 0.8, depth: 3.4, speed: 1.45, idle: 1, touchRadius: 0.21, touchTrail: 1.9, touchPush: 13
};
const fx = createInteractiveParticles({ container: stage, ...PAGE_DEFAULTS, onUpdate: showCount });
stage.append(fx.touchCanvas); // the trail texture, shown by the preview switch
// <- STEP 05

// every slider drives one option: [input name, option, decimals shown]
const SLIDERS = [
  ['grid-size', 'gridSize', 0], ['brightness', 'brightness', 0], ['contrast', 'contrast', 2], ['threshold', 'threshold', 0], ['size', 'size', 2], ['variation', 'variation', 2],
  ['edge', 'edge', 2], ['random', 'random', 1], ['depth', 'depth', 1], ['speed', 'speed', 2], ['idle', 'idle', 2],
  ['touch-radius', 'touchRadius', 2], ['touch-trail', 'touchTrail', 1], ['touch-push', 'touchPush', 0]
];

for (const [name, option, digits] of SLIDERS) {
  const input = field(name);
  input.addEventListener('input', () => {
    const value = Number(input.value);
    input.closest('.row').querySelector('output').value = value.toFixed(digits);
    fx.set(option, value);
  });
}

document.querySelectorAll('[name="shape"]').forEach(radio => radio.addEventListener('change', () => fx.set('shape', Number(radio.value))));

// STEP 05 -> tone (colour or the original's grey) and the background colour
document.querySelectorAll('[name="tone"]').forEach(radio => radio.addEventListener('change', () => fx.set('grey', radio.value === 'grey')));

const backgroundInput = field('background');
backgroundInput.addEventListener('input', () => fx.set('background', backgroundInput.value));

// Dark particles would vanish on black: switching the mode by hand also flips the background to paper (and light
// particles back to black). Only a real click does it (isTrusted): restoring saved settings or a reset fires the
// switch too, and must leave the background they restore alone, whichever order the rows come in.
const invertInput = field('invert');
invertInput.addEventListener('change', e => {
  fx.set('invert', invertInput.checked);
  if (!e.isTrusted) return;
  backgroundInput.value = invertInput.checked ? '#ffffff' : '#000000';
  backgroundInput.dispatchEvent(new Event('input', { bubbles: true }));
});
// <- STEP 05

const previewInput = field('touch-preview');
previewInput.addEventListener('change', () => stage.classList.toggle('is-showing-touch', previewInput.checked));

// the image: upload, drop, or back to the Gropius portrait; an upload is remembered for the next visit
function useFile(file) {
  saveImage(file);
  fx.setImage(file).catch(() => { badge.textContent = 'Could not read that image'; });
}

field('image-file').addEventListener('change', e => {
  const file = e.target.files[0];
  if (file) useFile(file);
  e.target.value = ''; // so picking the same file again still fires change
});

document.querySelector('.reset-button').addEventListener('click', () => { clearSavedImage(); fx.setImage(DEFAULT_IMAGE); });

stage.addEventListener('dragover', e => { e.preventDefault(); stage.classList.add('is-dragging'); });
stage.addEventListener('dragleave', () => stage.classList.remove('is-dragging'));
stage.addEventListener('drop', e => {
  e.preventDefault();
  stage.classList.remove('is-dragging');
  const file = [...e.dataTransfer.files].find(f => f.type.startsWith('image/'));
  if (file) useFile(file);
});

// a prompt that rebuilds the effect as it looks right now: the technique plus every current value. The image is
// left out, to be attached separately.
const SDFS = ['0.5 - length(p)', '0.5 - max(a.x, a.y)', '0.5 - (a.x + a.y)', '0.12 - abs(length(p) - 0.36)', 'min(0.14 - min(a.x, a.y), 0.4 - max(a.x, a.y))'];

function promptText() {
  const cfg = fx.get();
  const now = fx.info();
  const shapeName = SHAPES[cfg.shape];
  const keep = cfg.invert
    ? `brightness < ${255 - cfg.threshold} (dark particles: keep the dark pixels, skip the light ones)`
    : `brightness > ${cfg.threshold} (light particles: keep the light pixels, skip the dark ones)`;
  const aspect = now ? `The current image makes a ${now.width} x ${now.height} grid; ${now.count} pixels become particles.` : '';
  return `Recreate this WebGL effect: an image turned into interactive particles, after the Codrops tutorial "Interactive Particles with Three.js" (Bruno Imbrizi, 2019). I'll attach the source image separately.

Stack: three.js 0.170.0 as an ES module (import map, jsdelivr), no build step, one full-window canvas, devicePixelRatio capped at 2. Package it as createInteractiveParticles({ container, image, ...options }) returning { setImage, set(name, value), destroy }.

Pipeline
1. Draw the image to an offscreen canvas so its longest side is ${cfg.gridSize} px, keeping the aspect ratio ("contain"), and read it with getImageData. Tone every channel first: v = clamp((v - 128) * ${cfg.contrast} + 128 + ${cfg.brightness}, 0, 255), and put the toned pixels back (they are the colours too). ${aspect}
2. Perceived brightness per pixel: 0.21 R + 0.72 G + 0.07 B (0-255). Keep a pixel when ${keep}.
3. One InstancedBufferGeometry: a 1 x 1 quad (4 vertices, uv, index [0,2,1, 2,3,1]) drawn once per kept pixel. Instanced attributes: offset = (column, height - 1 - row, 0), pindex = the pixel's index in the grid, angle = random 0..PI.
4. The grid canvas as a CanvasTexture: SRGBColorSpace, NearestFilter for min and mag, no mipmaps. Sample it at the pixel centre: vPUv = (offset.xy + 0.5) / textureSize.
5. ShaderMaterial, transparent, depthTest false; mesh.frustumCulled = false (the bounding sphere is the quad's, not the image's).
6. PerspectiveCamera, fov 50, placed so the grid fills 1 / 1.1 of the view (1 world unit = 1 grid pixel). Clear colour ${cfg.background}.

Vertex shader (2D simplex noise snoise from Ashima Arts; random(n) = fract(sin(n) * 43758.5453123))
- hide = 1.0 - uShow (the transition: uShow 0 scattered, 1 assembled)
- grey = brightness of the texture at vPUv (0.21, 0.71, 0.07)${cfg.invert ? ', then grey = 1.0 - grey (dark particles: darkness sets the size)' : ''}
- displaced = offset; displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * (uRandom + hide * 8.0)
- rndz = random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1)); displaced.z += rndz * random(pindex) * 2.0 * (uDepth + hide * 40.0)
- touch: t = texture2D(uTouch, vPUv).r; displaced.z += t * uTouchPush * rndz; displaced.xy += vec2(cos(angle), sin(angle)) * t * uTouchPush * rndz
- displaced.xy -= textureSize * 0.5 (centre the grid)
- varied = (snoise(vec2(uTime, pindex) * 0.5) + 2.0) * max(grey, 0.2); psize = uSize * max(mix(1.0, varied, uVariation), 0.0) * uShow
- billboard: mvPosition = modelViewMatrix * vec4(displaced, 1.0); mvPosition.xyz += position * psize

Fragment shader
- colour = texture2D(uTexture, vPUv).rgb${cfg.grey ? ', drawn in grey: vec3(0.21 r + 0.71 g + 0.07 b)' : ', keeping the image\'s colours'}; end with #include <colorspace_fragment>
- shape ${shapeName}, a distance function of p = vUv - 0.5, a = abs(p): d = ${SDFS[cfg.shape]}
- alpha = smoothstep(0.0, max(uEdge, 0.001), d)

Touch texture (the pointer's trail, sampled by the vertex shader as uTouch)
- a 64 x 64 canvas, cleared to black every frame, uploaded as a CanvasTexture (needsUpdate each frame)
- pointermove on the canvas: NDC from the pointer, Raycaster.setFromCamera, intersect an invisible PlaneGeometry(gridWidth, gridHeight) at the origin; its hit uv is the trail point
- each point: force = min(squared distance to the previous point * 10000, 1) (0 for the first); age += dt; removed after ${cfg.touchTrail} s
- drawn every frame: life = easeOutSine(age / (0.3 * trail)) while growing, then easeOutSine(1 - (age - 0.3 * trail) / (0.7 * trail)); radius = 64 * ${cfg.touchRadius} * life * force; a radial gradient from radius * 0.25 (rgba(255,255,255,0.2)) to radius (transparent) at (x * 64, (1 - y) * 64)

Transitions: a new image tweens uShow to 0 over ${(cfg.transition * 0.6).toFixed(2)} s, rebuilds, then tweens it to 1 over ${cfg.transition} s (easeInOutCubic); the first image assembles the same way.

Animation: setAnimationLoop; uTime += min(dt, 0.1) * speed with dt in real seconds (times idle = ${cfg.idle} while the pointer is not over the canvas: pointerenter / pointerleave), and the touch texture updates with the same dt. The loop runs only while the canvas is on screen (IntersectionObserver). Under prefers-reduced-motion: no noise motion, no transitions; the loop runs only while a touch trail is fading. destroy() stops the loop, disconnects observers, removes listeners and disposes geometry, materials, both textures and the renderer.

Current values
- grid size (longest side): ${cfg.gridSize} px, brightness ${cfg.brightness}, contrast ${cfg.contrast}
- particles from: ${cfg.invert ? 'dark' : 'light'} pixels, threshold ${cfg.threshold}
- uSize: ${cfg.size}
- uVariation: ${cfg.variation}
- shape: ${shapeName}, uEdge: ${cfg.edge}, tone: ${cfg.grey ? 'grey' : 'colour'}
- uRandom: ${cfg.random}
- uDepth: ${cfg.depth}
- speed: ${cfg.speed}, idle: ${cfg.idle}
- touch radius: ${cfg.touchRadius} of the texture width, trail: ${cfg.touchTrail} s, uTouchPush: ${cfg.touchPush}
- transition: ${cfg.transition} s, background: ${cfg.background}`;
}

bindCopyButton(document.getElementById('copyPrompt'), promptText);
bindSaveButton(document.getElementById('saveSettings'), panel);
bindResetButton(document.getElementById('resetSettings'), panel);

// a small ▲ / ▼ at the end of every slider row, for fine tuning
fineTune(panel);

// the panel as it was before a refresh in this tab, or as saved (after the handlers above, so they apply it)
restoreUi(panel);

// start with the last uploaded image if there is one, the Gropius portrait otherwise; it assembles in
fx.setImage((await loadSavedImage()) ?? DEFAULT_IMAGE).catch(() => fx.setImage(DEFAULT_IMAGE));
