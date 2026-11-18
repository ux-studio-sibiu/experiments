// interactive-particles.js - the canonical module: an image turned into interactive particles, after the Codrops
// tutorial "Interactive Particles with Three.js" (Bruno Imbrizi, 2019). three.js 0.170, no build step.
//
//   import { createInteractiveParticles } from './interactive-particles.js';
//   const fx = createInteractiveParticles({ container, image: 'portrait.jpg' });
//   fx.set('shape', 1); fx.setImage(file); fx.destroy();
//
// Needs an import map for 'three'. The STEP comments mark the stages the effect was built up in (image to pixels,
// instancing, shader motion, touch texture, transitions).

import * as THREE from 'three';

export const DEFAULTS = {
  container: null, // element the canvas fills; required
  image: null, // first image: a URL, a File / Blob, or an <img>
  gridSize: 240, // longest side of the particle grid, in pixels
  brightness: 0, // added to every pixel (-100 to 100) before anything is decided: the threshold, the size, the colour
  contrast: 1, // every pixel scaled about mid-grey first: 1 as it is, below 1 flatter, above 1 harder
  threshold: 34, // pixels darker than this (0-255) get no particle
  invert: false, // flip the threshold: keep the dark pixels, skip the ones lighter than 255 - threshold
  size: 1.5, // particle diameter in grid pixels, before brightness and noise scale it
  variation: 1, // how much brightness and noise vary the size: 0 all the same, 1 the original, 2 twice as much
  shape: 0, // 0 circle, 1 square, 2 diamond, 3 ring, 4 cross
  edge: 0.3, // how soft the shape's edge is: 0 crisp, 0.5 a blur to the centre
  grey: false, // draw the particles in grey (the original's look) instead of the image's colours
  random: 2, // how far each particle is scattered from its pixel, in grid pixels
  depth: 4, // how far particles drift towards and away from the camera
  speed: 1, // how fast the noise moves; 0 freezes it
  idle: 1, // the noise's speed while the pointer is away, as a share of speed: 0 still until pointed at
  touchRadius: 0.15, // the pointer's dot, as a share of the touch texture's width
  touchTrail: 2, // seconds a point of the trail takes to fade
  touchPush: 20, // how far a touched particle is pushed, in grid pixels
  transition: 1.2, // seconds for a new image to assemble (the old one scatters in 60% of that); 0 = instant
  background: '#000000', // the canvas's clear colour
  respectReducedMotion: true, // under prefers-reduced-motion: no noise motion, no transitions
  onUpdate: null // called with { width, height, count } whenever the particles are rebuilt
};

export const SHAPES = ['circle', 'square', 'diamond', 'ring', 'cross'];

// option -> the uniform it drives; options not listed are read on the CPU
const UNIFORMS = { size: 'uSize', variation: 'uVariation', shape: 'uShape', edge: 'uEdge', random: 'uRandom', depth: 'uDepth', touchPush: 'uTouchPush', grey: 'uGrey' };

// STEP 03 -> 2D simplex noise (Ashima Arts / Stefan Gustavson, MIT): smooth random values from -1 to 1
const snoise = /* glsl */ `
  vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec2 mod289(vec2 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
  vec3 permute(vec3 x) { return mod289(((x * 34.0) + 1.0) * x); }

  float snoise(vec2 v) {
    const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
    vec2 i = floor(v + dot(v, C.yy));
    vec2 x0 = v - i + dot(i, C.xx);
    vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
    vec4 x12 = x0.xyxy + C.xxzz;
    x12.xy -= i1;
    i = mod289(i);
    vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
    vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
    m = m * m;
    m = m * m;
    vec3 x = 2.0 * fract(p * C.www) - 1.0;
    vec3 h = abs(x) - 0.5;
    vec3 ox = floor(x + 0.5);
    vec3 a0 = x - ox;
    m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
    vec3 g;
    g.x = a0.x * x0.x + h.x * x0.y;
    g.yz = a0.yz * x12.xz + h.yz * x12.yw;
    return 130.0 * dot(m, g);
  }

  // a fixed random number per seed: the same particle always gets the same value
  float random(float n) { return fract(sin(n) * 43758.5453123); }
`;
// <- STEP 03

// the shaders. Each instance is a 1 x 1 quad moved to its pixel and scaled by its size.
const vertexShader = /* glsl */ `
  attribute vec3 offset; // the pixel's column and row, y counted up from the bottom
  attribute float pindex; // the pixel's index in the grid: the seed for everything random below
  attribute float angle; // a random direction per particle: the way it is pushed when touched

  uniform sampler2D uTexture;
  uniform vec2 uTextureSize;
  uniform float uSize;
  uniform float uTime;
  uniform float uRandom;
  uniform float uDepth;
  uniform float uVariation; // how much noise and brightness change each particle's size: 0 none, 1 the original
  uniform float uInvert; // 1 when the threshold is inverted: dark pixels become the big particles
  uniform sampler2D uTouch; // the pointer's fading trail, white where it has just been
  uniform float uTouchPush; // how far a fully touched particle moves
  uniform float uShow; // 0 scattered and invisible, 1 assembled: the transition between images

  varying vec2 vUv; // where on the quad: (0, 0) to (1, 1)
  varying vec2 vPUv; // where on the image: the pixel's centre in texture space

  ${snoise}

  void main() {
    vUv = uv;
    vPUv = (offset.xy + 0.5) / uTextureSize;
    float hide = 1.0 - uShow; // STEP 05: how far into the scatter this particle is

    // STEP 03 -> brightness of this particle's pixel, read in the vertex shader
    vec4 color = texture2D(uTexture, vPUv);
    float grey = color.r * 0.21 + color.g * 0.71 + color.b * 0.07;
    grey = mix(grey, 1.0 - grey, uInvert); // inverted, size follows darkness instead of brightness

    vec3 displaced = offset;
    // scatter: a fixed random nudge in x and y, different per particle (wider while the image is hidden)
    displaced.xy += vec2(random(pindex) - 0.5, random(offset.x + pindex) - 0.5) * (uRandom + hide * 8.0);
    // depth: noise over time, so each particle drifts towards and away from the camera on its own
    float rndz = random(pindex) + snoise(vec2(pindex * 0.1, uTime * 0.1));
    displaced.z += rndz * (random(pindex) * 2.0 * (uDepth + hide * 40.0));
    // <- STEP 03
    // STEP 04 -> touch: where the trail is bright, push the particle towards the camera and out along its angle
    float t = texture2D(uTouch, vPUv).r;
    displaced.z += t * uTouchPush * rndz;
    displaced.x += cos(angle) * t * uTouchPush * rndz;
    displaced.y += sin(angle) * t * uTouchPush * rndz;
    // <- STEP 04
    displaced.xy -= uTextureSize * 0.5; // centre the grid on the origin

    // STEP 03 -> size: noise between 1x and 3x, times brightness (dark pixels stay small but never vanish)
    float varied = (snoise(vec2(uTime, pindex) * 0.5) + 2.0) * max(grey, 0.2);
    // variation 0: every particle is uSize; 1: the original's spread; above 1: pushed further, never below 0
    float psize = uSize * max(mix(1.0, varied, uVariation), 0.0);
    // <- STEP 03
    psize *= uShow; // STEP 05: particles grow in as the image assembles

    vec4 mvPosition = modelViewMatrix * vec4(displaced, 1.0);
    mvPosition.xyz += position * psize; // grow the quad around its centre, facing the camera
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D uTexture;
  uniform float uShape; // 0 circle, 1 square, 2 diamond, 3 ring, 4 cross
  uniform float uEdge; // edge softness, in quad units (the quad is 1 wide)
  uniform float uGrey; // 1: the pixel's brightness instead of its colour

  varying vec2 vUv;
  varying vec2 vPUv;

  // how far inside the shape this point is: 0 on the edge, positive inside, negative outside
  float shapeDistance(vec2 p) {
    vec2 a = abs(p);
    if (uShape < 0.5) return 0.5 - length(p); // circle touching the quad's sides
    if (uShape < 1.5) return 0.5 - max(a.x, a.y); // the whole quad
    if (uShape < 2.5) return 0.5 - (a.x + a.y); // a square turned 45 degrees
    if (uShape < 3.5) return 0.12 - abs(length(p) - 0.36); // a band either side of radius 0.36
    return min(0.14 - min(a.x, a.y), 0.4 - max(a.x, a.y)); // two crossed bars, arms short of the edge so neighbours stay apart
  }

  void main() {
    vec4 color = texture2D(uTexture, vPUv);
    // STEP 05 -> grey: the same weights as the brightness test, in linear light
    float grey = color.r * 0.21 + color.g * 0.71 + color.b * 0.07;
    vec3 rgb = mix(color.rgb, vec3(grey), uGrey);
    // <- STEP 05

    // the shape with a soft edge: 1 well inside, fading to 0 at the edge over uEdge
    float dist = shapeDistance(vUv - 0.5);
    float alpha = smoothstep(0.0, max(uEdge, 0.001), dist);

    gl_FragColor = vec4(rgb, alpha);
    #include <colorspace_fragment>
  }
`;

// STEP 04 -> the touch texture: the pointer's trail as soft white dots on a small black canvas, uploaded every
// frame. Each point grows in over the first 30% of its life and fades out over the rest.
const easeOutSine = t => Math.sin((t * Math.PI) / 2);

class TouchTexture {
  constructor(cfg, size = 64) {
    this.cfg = cfg;
    this.size = size;
    this.trail = [];
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.canvas.height = size;
    this.canvas.className = 'touch-preview';
    this.ctx = this.canvas.getContext('2d');
    this.clear();
    this.texture = new THREE.CanvasTexture(this.canvas);
  }

  clear() {
    this.ctx.fillStyle = '#000000';
    this.ctx.fillRect(0, 0, this.size, this.size);
  }

  // uv: where on the image, (0, 0) bottom-left to (1, 1) top-right. A fast move pushes harder than a slow one.
  addTouch(uv) {
    const last = this.trail[this.trail.length - 1];
    let force = 0;
    if (last) {
      const dx = last.x - uv.x, dy = last.y - uv.y;
      force = Math.min((dx * dx + dy * dy) * 10000, 1);
    }
    this.trail.push({ x: uv.x, y: uv.y, age: 0, force });
  }

  update(dt) {
    this.clear();
    for (const point of this.trail) point.age += dt;
    this.trail = this.trail.filter(point => point.age < this.cfg.touchTrail);
    for (const point of this.trail) this.draw(point);
    this.texture.needsUpdate = true;
  }

  draw(point) {
    const max = this.cfg.touchTrail;
    const grow = max * 0.3;
    const life = point.age < grow ? easeOutSine(point.age / grow) : easeOutSine(1 - (point.age - grow) / (max - grow));
    const radius = this.size * this.cfg.touchRadius * life * point.force;
    if (radius <= 0) return;
    const x = point.x * this.size, y = (1 - point.y) * this.size; // canvas y goes down
    const gradient = this.ctx.createRadialGradient(x, y, radius * 0.25, x, y, radius);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.2)');
    gradient.addColorStop(1, 'rgba(0, 0, 0, 0)');
    this.ctx.beginPath();
    this.ctx.fillStyle = gradient;
    this.ctx.arc(x, y, radius, 0, Math.PI * 2);
    this.ctx.fill();
  }

  dispose() { this.texture.dispose(); }
}
// <- STEP 04

// load anything: a URL, a File / Blob, or an <img>. Calls back with the object URL it made, to revoke later.
function loadImage(source, onObjectUrl) {
  if (source instanceof HTMLImageElement && source.complete && source.naturalWidth) return Promise.resolve(source);
  const url = source instanceof Blob ? URL.createObjectURL(source) : source instanceof HTMLImageElement ? source.src : source;
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { if (source instanceof Blob) onObjectUrl(url); resolve(img); };
    img.onerror = reject;
    img.src = url;
  });
}

// shrink the image so its longest side is maxSide ("contain"), then read the pixels
// the image at the grid's size, its pixels toned first: contrast about mid-grey, then brightness added, clamped
function fitToGrid(img, maxSide, brightness = 0, contrast = 1) {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  ctx.drawImage(img, 0, 0, width, height);
  const pixels = ctx.getImageData(0, 0, width, height);
  if (brightness !== 0 || contrast !== 1) {
    const d = pixels.data;
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) d[i + c] = Math.min(255, Math.max(0, (d[i + c] - 128) * contrast + 128 + brightness));
    }
    ctx.putImageData(pixels, 0, 0); // the toned pixels are the colours too
  }
  // keep the canvas too: it becomes the texture the shader reads colours from
  return { width, height, data: pixels.data, canvas };
}

const easeInOutCubic = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export function createInteractiveParticles(options = {}) {
  const cfg = { ...DEFAULTS, ...options };
  const container = cfg.container;
  if (!container) throw new Error('createInteractiveParticles: options.container is required');
  const reducedMotion = cfg.respectReducedMotion && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // a 3x screen would render 9x the pixels for no gain
  renderer.setClearColor(new THREE.Color(cfg.background));
  Object.assign(renderer.domElement.style, { display: 'block', width: '100%', height: '100%', touchAction: 'none' });
  container.prepend(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 1, 10000);

  let image = null; // the current <img>, kept so the grid can be rebuilt at a new size
  let grid = null; // { width, height, data, canvas } of the current image
  let particles = null;
  let texture = null;
  let objectUrl = null;

  // STEP 03 -> the clock the shader reads. Kept outside the material so it survives rebuilds.
  const uTime = { value: 0 };
  // <- STEP 03
  // STEP 05 -> the transition, shared the same way: 0 scattered, 1 assembled
  const uShow = { value: 0 };
  // <- STEP 05

  // STEP 04 -> the trail and the invisible plane that turns the pointer into image coordinates (its uv)
  const touch = new TouchTexture(cfg);
  const hitPlane = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial());
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // <- STEP 04

  // one quad, drawn once per kept pixel, with the per-particle data as instanced attributes
  function buildParticles() {
    const { width, height, data } = grid;
    const count = width * height;

    // brightness of each pixel, the same weights as the original (perceived, green counts most)
    const kept = [];
    for (let i = 0; i < count; i++) {
      const brightness = data[i * 4] * 0.21 + data[i * 4 + 1] * 0.72 + data[i * 4 + 2] * 0.07;
      // inverted, the same slider cuts from the light end: dark ink on white paper instead of light on black
      const keep = cfg.invert ? brightness < 255 - cfg.threshold : brightness > cfg.threshold;
      if (keep) kept.push(i);
    }

    const offsets = new Float32Array(kept.length * 3);
    const indices = new Float32Array(kept.length);
    const angles = new Float32Array(kept.length);
    kept.forEach((i, j) => {
      offsets[j * 3] = i % width;
      offsets[j * 3 + 1] = height - 1 - Math.floor(i / width); // canvas rows go down, three.js y goes up
      indices[j] = i;
      angles[j] = Math.random() * Math.PI;
    });

    const geometry = new THREE.InstancedBufferGeometry();
    // the shared quad: 4 corners, 2 triangles
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.5, 0.5, 0, 0.5, 0.5, 0, -0.5, -0.5, 0, 0.5, -0.5, 0]), 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 1, 1, 1, 0, 0, 1, 0]), 2));
    geometry.setIndex([0, 2, 1, 2, 3, 1]);
    // one value per particle, not per vertex
    geometry.setAttribute('offset', new THREE.InstancedBufferAttribute(offsets, 3));
    geometry.setAttribute('pindex', new THREE.InstancedBufferAttribute(indices, 1));
    geometry.setAttribute('angle', new THREE.InstancedBufferAttribute(angles, 1));
    geometry.instanceCount = kept.length;

    const uniforms = {
      uTexture: { value: texture },
      uTextureSize: { value: new THREE.Vector2(width, height) },
      uInvert: { value: cfg.invert ? 1 : 0 },
      uTime, // shared: a rebuild doesn't restart the clock
      uTouch: { value: touch.texture }, // shared: a new image keeps the trail
      uShow // shared: a rebuild mid-transition carries on
    };
    for (const [option, uniform] of Object.entries(UNIFORMS)) uniforms[uniform] = { value: Number(cfg[option]) };

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      transparent: true,
      depthTest: false // overlapping soft edges blend instead of cutting holes in each other
    });

    const mesh = new THREE.Mesh(geometry, material);
    mesh.frustumCulled = false; // the bounding sphere is the 1 x 1 quad's, not the image's: three.js would cull it
    return mesh;
  }

  function rebuild() {
    if (!image) return;
    grid = fitToGrid(image, cfg.gridSize, Number(cfg.brightness), Number(cfg.contrast));
    // the grid canvas as a texture: sRGB, so three.js converts the colours to linear when it samples
    if (texture) texture.dispose();
    texture = new THREE.CanvasTexture(grid.canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.minFilter = texture.magFilter = THREE.NearestFilter; // one exact pixel per particle, no blending between neighbours
    texture.generateMipmaps = false;
    rebuildParticles();
  }

  // the threshold only changes which pixels get a particle: rebuild the geometry, keep the texture
  function rebuildParticles() {
    if (!grid) return;
    if (particles) {
      scene.remove(particles);
      particles.geometry.dispose(); // GPU memory isn't garbage-collected: free the old buffers
      particles.material.dispose();
    }
    particles = buildParticles();
    scene.add(particles);
    hitPlane.geometry.dispose(); // the hit plane takes the grid's size (in grid pixels, centred like the particles)
    hitPlane.geometry = new THREE.PlaneGeometry(grid.width, grid.height);
    fitCamera();
    render();
    cfg.onUpdate?.(info());
  }

  // place the camera so the grid fills the container with a margin; 1 world unit = 1 grid pixel
  function fitCamera() {
    if (!grid) return;
    const fit = 1.1;
    const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const distH = (grid.height * fit) / 2 / Math.tan(halfFov);
    const distW = (grid.width * fit) / 2 / Math.tan(halfFov) / camera.aspect;
    camera.position.z = Math.max(distH, distW);
    camera.updateProjectionMatrix();
  }

  // STEP 03 -> the render loop: advance the clock by the real time since the last frame, times the speed
  let lastTime = null;

  function tick(time) {
    const dt = Math.min(lastTime === null ? 0 : (time - lastTime) / 1000, 0.1); // capped, so a tab coming back doesn't jump
    lastTime = time;
    if (!reducedMotion) uTime.value += dt * cfg.speed * (pointedAt ? 1 : cfg.idle); // slower (or still) while nobody points
    touch.update(dt); // STEP 04: age and redraw the trail
    renderer.render(scene, camera);
    // reduced motion: the loop runs only while a trail is fading, then stops again
    if (reducedMotion && !touch.trail.length) stopLoop();
  }

  // with the loop running every frame, changes don't need their own render; without it they do
  function render() { if (!looping) renderer.render(scene, camera); }
  // <- STEP 03

  // STEP 05 -> the loop runs only while the canvas is on screen (an IntersectionObserver), and under reduced
  // motion only while a trail is fading. Background tabs are paused by the browser already.
  let looping = false;
  let onScreen = true;
  function startLoop() {
    if (looping || !onScreen) return;
    looping = true;
    renderer.setAnimationLoop(tick);
  }
  function stopLoop() {
    looping = false;
    lastTime = null;
    renderer.setAnimationLoop(null);
  }
  const visibility = new IntersectionObserver(([entry]) => {
    onScreen = entry.isIntersecting;
    if (!onScreen) stopLoop();
    else if (!reducedMotion) startLoop();
  });
  visibility.observe(container);
  // <- STEP 05

  // STEP 05 -> the transition: tween uShow on its own rAF. A newer transition cancels an older one.
  let transitionId = 0;
  function animateShow(to, seconds) {
    const id = ++transitionId;
    const from = uShow.value;
    if (seconds <= 0 || reducedMotion) { uShow.value = to; render(); return Promise.resolve(); }
    return new Promise(resolve => {
      const start = performance.now();
      const step = now => {
        if (id !== transitionId) return resolve();
        const p = Math.min((now - start) / (seconds * 1000), 1);
        uShow.value = from + (to - from) * easeInOutCubic(p);
        render();
        if (p < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  // a new image: the current one scatters, the grid is rebuilt, the new one assembles. A later call wins.
  let loadId = 0;
  async function setImage(source) {
    const id = ++loadId;
    const img = await loadImage(source, url => {
      if (objectUrl) URL.revokeObjectURL(objectUrl); // revoke the previous upload only once the new one has loaded
      objectUrl = url;
    });
    if (id !== loadId) return;
    if (particles && uShow.value > 0) await animateShow(0, cfg.transition * 0.6);
    if (id !== loadId) return;
    image = img;
    rebuild();
    await animateShow(1, cfg.transition);
  }
  // <- STEP 05

  // STEP 04 -> the pointer: to normalised device coordinates, a ray from the camera, the hit plane's uv
  function onPointerMove(e) {
    if (!particles) return;
    const rect = container.getBoundingClientRect();
    pointer.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(hitPlane)[0];
    if (!hit) return;
    touch.addTouch(hit.uv);
    if (reducedMotion) startLoop(); // a touch is the user's own motion: let its trail play out
  }
  container.addEventListener('pointermove', onPointerMove);
  // <- STEP 04

  // pointed at or not, for the idle speed: over the container at all (the panel beside it counts as away)
  let pointedAt = false;
  const onPointerEnter = () => { pointedAt = true; };
  const onPointerLeave = () => { pointedAt = false; };
  container.addEventListener('pointerenter', onPointerEnter);
  container.addEventListener('pointerleave', onPointerLeave);

  function resize() {
    const { clientWidth: w, clientHeight: h } = container;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    fitCamera();
    camera.updateProjectionMatrix();
    render();
  }
  const sizing = new ResizeObserver(resize);
  sizing.observe(container);

  // change any option at runtime: uniforms are set in place; the grid size and tone rebuild the grid, the threshold the particles
  function set(name, value) {
    if (!(name in DEFAULTS) || name === 'container') return;
    cfg[name] = value;
    if (name === 'gridSize' || name === 'brightness' || name === 'contrast') rebuild();
    else if (name === 'threshold' || name === 'invert') rebuildParticles();
    else if (name === 'background') renderer.setClearColor(new THREE.Color(value));
    else if (UNIFORMS[name] && particles) particles.material.uniforms[UNIFORMS[name]].value = Number(value);
    render();
  }

  function info() {
    return grid ? { width: grid.width, height: grid.height, count: particles.geometry.instanceCount } : null;
  }

  // STEP 05 -> leave nothing behind: loops, observers, listeners, and every GPU resource
  function destroy() {
    transitionId++;
    loadId++;
    stopLoop();
    visibility.disconnect();
    sizing.disconnect();
    container.removeEventListener('pointermove', onPointerMove);
    container.removeEventListener('pointerenter', onPointerEnter);
    container.removeEventListener('pointerleave', onPointerLeave);
    if (particles) { particles.geometry.dispose(); particles.material.dispose(); }
    texture?.dispose();
    touch.dispose();
    hitPlane.geometry.dispose();
    hitPlane.material.dispose();
    renderer.dispose();
    renderer.forceContextLoss();
    renderer.domElement.remove();
    touch.canvas.remove();
    if (objectUrl) URL.revokeObjectURL(objectUrl);
  }
  // <- STEP 05

  if (!reducedMotion) startLoop();
  if (cfg.image) setImage(cfg.image).catch(() => {});

  return {
    setImage,
    set,
    get: () => ({ ...cfg, container: undefined, onUpdate: undefined }), // a copy of the current options
    info,
    touchCanvas: touch.canvas, // the trail texture, for a debug preview
    destroy
  };
}

if (typeof window !== 'undefined') window.createInteractiveParticles = createInteractiveParticles;
