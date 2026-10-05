import * as THREE from 'three';

// Shared drawing uniforms: every surface reads these, so one slider moves all.
export const draw = {
  uPaper: { value: new THREE.Color(0xffffff) },
  uInk: { value: new THREE.Color(0x16161a) },
  uExposure: { value: 0.73 },
  uHatchFreq: { value: 21.5 },
  uHatchOn: { value: 1 },
  uPatternOn: { value: 1 },
  uPatternBase: { value: 0.3 },
  uWash: { value: 0 },
  uGrain: { value: 0 },
  uContrast: { value: 2.25 },
  uHighlight: { value: 0.17 },
  uLine: { value: 0.012 },
};

const header = /* glsl */ `
varying vec3 vWPos;
varying vec3 vWNormal;
uniform sampler2D uPattern;
uniform vec2 uPatternTile;
uniform vec3 uPaper;
uniform vec3 uTint;
uniform vec3 uInk;
uniform float uExposure, uHatchFreq, uHatchOn, uPatternOn, uPatternBase, uWash, uGrain, uContrast, uHighlight, uTone, uHatchScale;

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// One family of pencil strokes. Width grows with darkness; each stroke
// wobbles a little and its pressure varies along its length.
float hatchLine(vec2 uv, float ang, float freq, float width) {
  vec2 dir = vec2(cos(ang), sin(ang));
  float d = dot(uv, dir) * freq;
  float along = dot(uv, vec2(-dir.y, dir.x)) * freq;
  float row = floor(d);
  d += 0.12 * sin(along * 0.35 + row * 1.7) + 0.08 * (hash12(vec2(row, ang * 10.0)) - 0.5);
  float f = abs(fract(d) - 0.5) * 2.0;
  float aa = fwidth(d) * 1.5;
  float l = 1.0 - smoothstep(width - aa, width + aa, f);
  float pressure = 0.7 + 0.3 * sin(along * 0.9 + row * 3.1);
  return l * smoothstep(0.0, 0.04, width) * pressure;
}

// Tonal ladder: diagonal, then cross-hatch, then a third horizontal pass.
float hatchAt(vec2 uv, float dark) {
  // uHatchScale spaces this surface's strokes.
  float f = uHatchFreq * uHatchScale;
  float h = hatchLine(uv, 0.785, f, clamp((dark - 0.18) * 0.7, 0.0, 0.45));
  h = max(h, hatchLine(uv, -0.785, f, clamp((dark - 0.45) * 0.7, 0.0, 0.45)));
  h = max(h, hatchLine(uv, 0.0, f * 1.4, clamp((dark - 0.7) * 0.8, 0.0, 0.45)));
  return h;
}
`;

const shade = /* glsl */ `
{
  // outgoingLight is the full physically based result (key, rim, torch,
  // room tint, webcam reflections). Only its brightness is kept: it decides
  // how much graphite goes down.
  float lum = dot(outgoingLight, vec3(0.2126, 0.7152, 0.0722));
  float dark = 1.0 - clamp(lum * uExposure, 0.0, 1.0);
  // Contrast around mid-grey deepens the shadows; the highlight floor keeps
  // even fully lit faces under a faint layer of graphite.
  // uTone then darkens one surface on its own (the table).
  dark = clamp((dark - 0.5) * uContrast + 0.5, 0.0, 1.0);
  dark = clamp(uHighlight + (1.0 - uHighlight) * dark + uTone, 0.0, 1.0);

  // Triplanar: strokes and patterns are laid on the surfaces in world space,
  // like a draughtsman rendering each face.
  vec3 w = pow(abs(normalize(vWNormal)), vec3(8.0));
  w /= (w.x + w.y + w.z);
  vec2 uvX = vWPos.zy, uvY = vWPos.xz, uvZ = vWPos.xy;

  float hatch = hatchAt(uvX, dark) * w.x + hatchAt(uvY, dark) * w.y + hatchAt(uvZ, dark) * w.z;
  float pat = texture2D(uPattern, uvX / uPatternTile).r * w.x
            + texture2D(uPattern, uvY / uPatternTile).r * w.y
            + texture2D(uPattern, uvZ / uPatternTile).r * w.z;
  float patInk = (1.0 - pat) * mix(uPatternBase, 1.0, smoothstep(0.1, 0.9, dark));

  float ink = max(hatch * uHatchOn, patInk * uPatternOn);
  ink *= 1.0 - uGrain * hash12(gl_FragCoord.xy);
  // Deep shadow (cast shadows above all) gets an extra layer of graphite.
  ink = clamp(ink + smoothstep(0.7, 0.95, dark) * 0.55, 0.0, 1.0);

  // A thin wash of the light's colour on the paper, so room light still reads.
  vec3 hue = outgoingLight / max(max(outgoingLight.r, outgoingLight.g), max(outgoingLight.b, 1e-3));
  // uTint colours this surface's paper, like drawing on tinted stock.
  vec3 paper = uPaper * uTint * mix(vec3(1.0), clamp(hue, 0.0, 1.0), uWash);
  outgoingLight = mix(paper, uInk, ink);
}
`;

const whiteTex = (() => {
  const c = document.createElement('canvas');
  c.width = c.height = 4;
  const x = c.getContext('2d');
  x.fillStyle = '#fff';
  x.fillRect(0, 0, 4, 4);
  return new THREE.CanvasTexture(c);
})();

// A lit, shadowed MeshStandardMaterial whose final colour is redrawn as
// pencil on paper.
export function drawingMaterial({ roughness = 0.8, metalness = 0, tone = 0 } = {}) {
  const local = {
    uPattern: { value: whiteTex },
    uPatternTile: { value: new THREE.Vector2(1, 1) },
    uTone: { value: tone },
    uTint: { value: new THREE.Color(1, 1, 1) },
    uHatchScale: { value: 1 },
  };
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness, metalness });
  mat.toneMapped = false;
  mat.polygonOffset = true;
  mat.polygonOffsetFactor = 1;
  mat.polygonOffsetUnits = 1;
  mat.userData.uniforms = local;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, draw, local);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWPos;\nvarying vec3 vWNormal;')
      .replace('#include <project_vertex>', '#include <project_vertex>\nvWPos = (modelMatrix * vec4(transformed, 1.0)).xyz;\nvWNormal = normalize(mat3(modelMatrix) * objectNormal);');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + header)
      .replace('#include <opaque_fragment>', shade + '\n#include <opaque_fragment>');
  };
  return mat;
}

// Ink for outlines: shares the ink colour instance with the shader.
export const lineMaterial = new THREE.LineBasicMaterial({ toneMapped: false });
lineMaterial.color = draw.uInk.value;

// Inverted hull: a back-face shell pushed out along the normals, so curved
// silhouettes (sphere, cone, drums) get a pencil contour.
export const hullMaterial = new THREE.MeshBasicMaterial({ side: THREE.BackSide, toneMapped: false });
hullMaterial.color = draw.uInk.value;
hullMaterial.onBeforeCompile = (shader) => {
  shader.uniforms.uLine = draw.uLine;
  shader.vertexShader = shader.vertexShader
    .replace('void main() {', 'uniform float uLine;\nvoid main() {')
    .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed += normal * uLine;');
};

// ---------- SVG patterns ----------

const PATTERN_DIR = '../background-experiments/patterns/';
const cache = new Map();

export async function listPatterns() {
  try {
    const src = await (await fetch('../background-experiments/patterns.js')).text();
    return [...src.matchAll(/n:'([^']+)'/g)].map((m) => m[1]);
  } catch {
    return ['brick-wall', 'diagonal-lines', 'graph-paper', 'floor-tile', 'topography', 'stripes'];
  }
}

// Rasterise a pattern in black on white into a repeating texture. Resolves to
// { tex, w, h } with the SVG's own tile size in px.
export function loadPattern(name, renderer) {
  if (name === 'none') return Promise.resolve({ tex: whiteTex, w: 100, h: 100 });
  if (!cache.has(name)) {
    cache.set(name, fetch(`${PATTERN_DIR}${name}.svg`).then((r) => r.text()).then((text) => new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth || 100, h = img.naturalHeight || 100;
        const k = Math.max(1, Math.min(8, Math.floor(512 / Math.max(w, h))));
        const c = document.createElement('canvas');
        c.width = w * k;
        c.height = h * k;
        const x = c.getContext('2d');
        x.fillStyle = '#fff';
        x.fillRect(0, 0, c.width, c.height);
        x.drawImage(img, 0, 0, c.width, c.height);
        const tex = new THREE.CanvasTexture(c);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        resolve({ tex, w, h });
      };
      img.onerror = reject;
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(text.replace(/currentColor/g, '#000'));
    })));
  }
  return cache.get(name);
}
