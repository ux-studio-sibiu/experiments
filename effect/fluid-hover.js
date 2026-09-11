// Fluid hover effect — Three.js + custom GLSL.
//
// Renders a fullscreen quad through a fragment shader that displaces both an
// image texture and a UI overlay (rasterised buttons) along the cursor's
// smoothed velocity vector. The result smears under fast mouse motion and
// settles into a soft "suction" pull at rest.
//
// Usage:
//   import { createFluidHover } from './fluid-hover.js';
//   const fx = createFluidHover({
//     container: document.getElementById('app'),
//     image: 'https://example.com/photo.jpg',
//     buttons: [
//       { label: 'Explore work', primary: true,  onClick: () => {} },
//       { label: 'Get in touch', primary: false, onClick: () => {} },
//     ],
//   });
//   fx.set('strength', 0.25);
//   fx.setImage(url);
//   fx.destroy();

import * as THREE from 'three';

const VERT = /* glsl */`
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position.xy, 0.0, 1.0);
  }
`;

const FRAG = /* glsl */`
  precision highp float;
  varying vec2 vUv;

  uniform sampler2D uTex;
  uniform sampler2D uOverlay;
  uniform vec2  uTexSize;
  uniform vec2  uResolution;
  uniform vec2  uMouse;
  uniform vec2  uMouseVel;
  uniform float uStrength;
  uniform float uRadius;
  uniform float uChroma;
  uniform float uTime;

  vec2 coverUv(vec2 uv, vec2 res, vec2 tex) {
    float rRes = res.x / res.y;
    float rTex = tex.x / tex.y;
    vec2 scale = (rRes > rTex)
      ? vec2(1.0, rTex / rRes)
      : vec2(rRes / rTex, 1.0);
    return (uv - 0.5) * scale + 0.5;
  }

  float aspectDist(vec2 a, vec2 b, vec2 res) {
    vec2 d = (a - b) * vec2(res.x / res.y, 1.0);
    return length(d);
  }

  void main() {
    vec2 uv = vUv;
    float d = aspectDist(uv, uMouse, uResolution);
    float falloff = exp(-uRadius * d);

    vec2 disp = uMouseVel * uStrength * falloff;
    vec2 pull = (uMouse - uv) * 0.15 * falloff;

    vec2 sampleUv = coverUv(uv + disp + pull, uResolution, uTexSize);

    float ca = uChroma * falloff * (0.5 + length(uMouseVel) * 6.0);
    vec2 dir = normalize(uMouseVel + vec2(1e-6));
    vec2 caShift = dir * ca;

    float r = texture2D(uTex, coverUv(uv + disp + pull + caShift, uResolution, uTexSize)).r;
    float g = texture2D(uTex, sampleUv).g;
    float b = texture2D(uTex, coverUv(uv + disp + pull - caShift, uResolution, uTexSize)).b;
    vec3 bg = vec3(r, g, b);

    vec2 ovUv = uv + disp + pull;
    float or_ = texture2D(uOverlay, ovUv + caShift).r;
    float og  = texture2D(uOverlay, ovUv          ).g;
    float ob  = texture2D(uOverlay, ovUv - caShift).b;
    float oa  = texture2D(uOverlay, ovUv          ).a;

    vec3 outc = mix(bg, vec3(or_, og, ob), oa);
    gl_FragColor = vec4(outc, 1.0);
  }
`;

function roundRectPath(c, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  c.beginPath();
  c.moveTo(x + r, y);
  c.arcTo(x + w, y,     x + w, y + h, r);
  c.arcTo(x + w, y + h, x,     y + h, r);
  c.arcTo(x,     y + h, x,     y,     r);
  c.arcTo(x,     y,     x + w, y,     r);
  c.closePath();
}

export function createFluidHover(opts = {}) {
  const {
    container,
    image = null,
    buttons = [],
    clearColor = 0x0b0b0c,
    strength = 0.18,
    radius   = 9.0,
    chroma   = 0.012,
    decay    = 0.94,
    // visual tuning for the rasterised buttons
    buttonStyle = {
      width: 260, height: 80, gap: 28, fontSize: 22,
      fontWeight: 600, fontFamily: 'ui-sans-serif, system-ui, sans-serif',
      fillPrimary:   'rgba(255,255,255,0.92)',
      fillSecondary: 'rgba(15,15,17,0.35)',
      stroke:        'rgba(255,255,255,0.85)',
      textPrimary:   '#0b0b0c',
      textSecondary: '#ffffff',
    },
  } = opts;

  if (!container) throw new Error('createFluidHover: `container` is required');

  // --- renderer + scene ------------------------------------------------------
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setClearColor(clearColor, 1);
  container.appendChild(renderer.domElement);

  const scene  = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  // --- overlay canvas (UI) ---------------------------------------------------
  const overlay  = document.createElement('canvas');
  const octx     = overlay.getContext('2d');
  const overlayTex = new THREE.CanvasTexture(overlay);
  overlayTex.colorSpace       = THREE.SRGBColorSpace;
  overlayTex.minFilter        = THREE.LinearFilter;
  overlayTex.magFilter        = THREE.LinearFilter;
  overlayTex.generateMipmaps  = false;
  overlayTex.premultiplyAlpha = false;

  // --- uniforms --------------------------------------------------------------
  const uniforms = {
    uTex:        { value: null },
    uTexSize:    { value: new THREE.Vector2(1, 1) },
    uResolution: { value: new THREE.Vector2(1, 1) },
    uMouse:      { value: new THREE.Vector2(0.5, 0.5) },
    uMouseVel:   { value: new THREE.Vector2(0, 0) },
    uStrength:   { value: strength },
    uRadius:     { value: radius },
    uChroma:     { value: chroma },
    uTime:       { value: 0 },
    uOverlay:    { value: overlayTex },
  };

  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: FRAG });
  const geometry = new THREE.PlaneGeometry(2, 2);
  const quad = new THREE.Mesh(geometry, material);
  scene.add(quad);

  // --- texture loader --------------------------------------------------------
  const loader = new THREE.TextureLoader();
  loader.setCrossOrigin('anonymous');

  function applyTexture(tex) {
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.wrapS = tex.wrapT = THREE.ClampToEdgeWrapping;
    if (uniforms.uTex.value) uniforms.uTex.value.dispose();
    uniforms.uTex.value = tex;
    const img = tex.image;
    uniforms.uTexSize.value.set(
      img.width  || img.naturalWidth  || 1,
      img.height || img.naturalHeight || 1,
    );
  }

  function setImage(src) {
    if (!src) return;
    if (src instanceof HTMLImageElement || src instanceof HTMLCanvasElement) {
      applyTexture(new THREE.Texture(src));
      uniforms.uTex.value.needsUpdate = true;
      return;
    }
    loader.load(src, applyTexture, undefined, () => { /* offline-safe */ });
  }
  if (image) setImage(image);

  // --- buttons ---------------------------------------------------------------
  const items = buttons.map((b) => ({ ...b, rect: { x: 0, y: 0, w: 0, h: 0 } }));
  let hoverIdx = -1;

  function layoutButtons() {
    const dpr = renderer.getPixelRatio();
    const W = overlay.width, H = overlay.height;
    const bw  = buttonStyle.width  * dpr;
    const bh  = buttonStyle.height * dpr;
    const gap = buttonStyle.gap    * dpr;
    const cy = H / 2 - bh / 2;
    const cx = W / 2;

    // Centre the row regardless of how many buttons there are.
    const total = items.length * bw + Math.max(0, items.length - 1) * gap;
    let x = cx - total / 2;
    for (const it of items) {
      it.rect.x = x; it.rect.y = cy; it.rect.w = bw; it.rect.h = bh;
      x += bw + gap;
    }
  }

  function drawOverlay() {
    const dpr = renderer.getPixelRatio();
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.font = `${buttonStyle.fontWeight} ${buttonStyle.fontSize * dpr}px ${buttonStyle.fontFamily}`;
    octx.textAlign = 'center';
    octx.textBaseline = 'middle';

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const r  = it.rect;
      const hovered = i === hoverIdx;
      // hover inverts the primary/secondary look so both buttons feel symmetric
      const filled = !!it.primary !== hovered;
      octx.fillStyle   = filled ? buttonStyle.fillPrimary : buttonStyle.fillSecondary;
      octx.strokeStyle = buttonStyle.stroke;
      octx.lineWidth   = 1 * dpr;
      roundRectPath(octx, r.x, r.y, r.w, r.h, r.h / 2);
      octx.fill();
      octx.stroke();
      octx.fillStyle = filled ? buttonStyle.textPrimary : buttonStyle.textSecondary;
      octx.fillText(it.label, r.x + r.w / 2, r.y + r.h / 2 + 1 * dpr);
    }
    overlayTex.needsUpdate = true;
  }

  function hitTest(cssX, cssY) {
    const dpr = renderer.getPixelRatio();
    const x = cssX * dpr, y = cssY * dpr;
    for (let i = 0; i < items.length; i++) {
      const r = items[i].rect;
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
    }
    return -1;
  }

  // --- input -----------------------------------------------------------------
  // raw cursor target + previous smoothed sample, used to derive velocity each
  // frame from the *smoothed* trajectory (raw mouse events are too jittery).
  const target = new THREE.Vector2(0.5, 0.5);
  const prev   = new THREE.Vector2(0.5, 0.5);
  let decayValue = decay;

  function onPointerMove(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const cx = e.clientX - rect.left, cy = e.clientY - rect.top;
    target.x = cx / rect.width;
    target.y = 1.0 - cy / rect.height; // flip Y for UV space

    const i = hitTest(cx, cy);
    if (i !== hoverIdx) {
      hoverIdx = i;
      drawOverlay();
      renderer.domElement.classList.toggle('hot', i >= 0);
    }
  }

  function onClick(e) {
    const rect = renderer.domElement.getBoundingClientRect();
    const i = hitTest(e.clientX - rect.left, e.clientY - rect.top);
    if (i >= 0 && typeof items[i].onClick === 'function') items[i].onClick();
  }

  window.addEventListener('pointermove', onPointerMove);
  renderer.domElement.addEventListener('click', onClick);

  // --- resize ----------------------------------------------------------------
  function resize() {
    const w = container.clientWidth  || window.innerWidth;
    const h = container.clientHeight || window.innerHeight;
    const dpr = renderer.getPixelRatio();
    renderer.setSize(w, h);
    uniforms.uResolution.value.set(w, h);
    overlay.width  = Math.max(1, Math.floor(w * dpr));
    overlay.height = Math.max(1, Math.floor(h * dpr));
    layoutButtons();
    drawOverlay();
  }
  window.addEventListener('resize', resize);
  resize();

  // --- loop ------------------------------------------------------------------
  const clock = new THREE.Clock();
  let rafId = 0;
  let running = true;

  function tick() {
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 1 / 30);

    // framerate-independent lerp toward the raw target
    const smoothing = 1 - Math.pow(0.001, dt);
    const sm = uniforms.uMouse.value;
    prev.copy(sm);
    sm.lerp(target, smoothing);

    // velocity from smoothed delta, mixed into a persistent decaying value so
    // the ripple lingers briefly after the cursor stops
    const instVx = (sm.x - prev.x) / Math.max(dt, 1e-3);
    const instVy = (sm.y - prev.y) / Math.max(dt, 1e-3);
    const vel = uniforms.uMouseVel.value;
    vel.x = vel.x * decayValue + instVx * (1 - decayValue) * 0.06;
    vel.y = vel.y * decayValue + instVy * (1 - decayValue) * 0.06;

    uniforms.uTime.value += dt;

    renderer.render(scene, camera);
    rafId = requestAnimationFrame(tick);
  }
  rafId = requestAnimationFrame(tick);

  // --- public API ------------------------------------------------------------
  const settableUniforms = { strength: 'uStrength', radius: 'uRadius', chroma: 'uChroma' };

  return {
    renderer,
    canvas: renderer.domElement,

    set(name, value) {
      if (name === 'decay') { decayValue = +value; return; }
      const key = settableUniforms[name];
      if (key) uniforms[key].value = +value;
    },

    setImage,

    redrawOverlay: drawOverlay,

    destroy() {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('resize', resize);
      renderer.domElement.removeEventListener('click', onClick);
      geometry.dispose();
      material.dispose();
      overlayTex.dispose();
      if (uniforms.uTex.value) uniforms.uTex.value.dispose();
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };
}
