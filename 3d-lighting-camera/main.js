import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import GUI from 'three/addons/libs/lil-gui.module.min.js';
import { draw, drawingMaterial, lineMaterial, hullMaterial, listPatterns, loadPattern } from './drawing-material.js';
import { TorchTracker } from './torch-tracker.js';

const params = {
  autoOrbit: false,
  keyLight: 2.4,
  rimLight: 0.5,
  sunAzimuth: 78,
  sunElevation: 46,
  sunCycle: false,
  sunSpeed: 12,
  showSun: true,
  showPlane: false,
  material: 'none',
  addColor: 'none',
  mouseSun: true,
  roomLight: true,
  reflections: true,
  envStrength: 1.0,
  realTorch: true,
  sensitivity: 3.5,
  minBlob: 4,
  maxBlob: 6,
  preferWhite: 1,
  ignoreBackground: true,
  torchLeash: 0.025,
  torchMaxSpeed: 180,
  mouseTorch: false,
  torchPower: 160,
  torchAngle: 11,
  torchSoftness: 0.6,
  paper: '#ffffff',
  ink: '#16161a',
  hatching: true,
  patterns: true,
  patternSize: 1,
  outlines: true,
};

// ---------- renderer / scene / camera ----------

const root = document.querySelector('.nsc-lighting-lab');
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
root.querySelector('.stage').appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(params.paper);
scene.fog = new THREE.Fog(params.paper, 14, 30);

const camera = new THREE.PerspectiveCamera(34, innerWidth / innerHeight, 0.1, 100);
camera.position.set(0.9, 4.6, 8.4);

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(0, 0.9, 0.1);
controls.enableDamping = true;
controls.minDistance = 5;
controls.maxDistance = 18;
controls.maxPolarAngle = Math.PI * 0.47;
controls.autoRotate = params.autoOrbit;
controls.autoRotateSpeed = 0.5;

// Default environment: a soft studio, swapped for the webcam when it is on.
const pmrem = new THREE.PMREMGenerator(renderer);
const studioEnv = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
scene.environment = studioEnv;
scene.environmentIntensity = 0.12;

// ---------- lights ----------

const hemi = new THREE.HemisphereLight(0xdfe8ff, 0x3a2e28, 0.15);
scene.add(hemi);

// The key light is the sun: placed by azimuth / elevation around the model,
// and its shadow frustum is wide enough for long low-sun shadows.
const key = new THREE.DirectionalLight(0xfff1e0, params.keyLight);
key.castShadow = true;
key.shadow.mapSize.set(2048, 2048);
key.shadow.camera.left = -9;
key.shadow.camera.right = 9;
key.shadow.camera.top = 9;
key.shadow.camera.bottom = -9;
key.shadow.camera.near = 0.5;
key.shadow.camera.far = 40;
key.shadow.bias = -0.0004;
key.shadow.normalBias = 0.02;
key.target.position.set(0, 0, 0);
scene.add(key, key.target);

const rim = new THREE.DirectionalLight(0x9fb8ff, params.rimLight);
rim.position.set(-5, 2, 4);
scene.add(rim);

const torch = new THREE.SpotLight(0xfff4e2, 0, 22, THREE.MathUtils.degToRad(params.torchAngle), params.torchSoftness, 1.2);
torch.castShadow = true;
torch.shadow.mapSize.set(1024, 1024);
torch.shadow.bias = -0.0006;
torch.shadow.normalBias = 0.02;
scene.add(torch, torch.target);

// ---------- the model ----------
// The classic academic still life of plaster solids: a cube turned to show
// two faces at front left, a tall cylinder behind it, a cone to the right and
// a sphere in front, on a bare table. Each solid has its own drawing
// material, so it can carry its own pattern (none by default, pure graphite
// like the reference drawing).

const surfaces = {
  ground: { pattern: 'none', mat: drawingMaterial({ roughness: 0.95, tone: 0.23 }) },
  cube: { pattern: 'none', mat: drawingMaterial({ roughness: 0.85 }) },
  cylinder: { pattern: 'none', mat: drawingMaterial({ roughness: 0.8 }) },
  cone: { pattern: 'none', mat: drawingMaterial({ roughness: 0.8 }) },
  sphere: { pattern: 'none', mat: drawingMaterial({ roughness: 0.5, metalness: 0.15 }) },
};

const solids = [];

function add(geometry, surface, x, y, z, { hull = false, ry = 0 } = {}) {
  const mesh = new THREE.Mesh(geometry, surfaces[surface].mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  solids.push(mesh);

  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(geometry, 30), lineMaterial);
  mesh.add(edges);
  if (hull) mesh.add(new THREE.Mesh(geometry, hullMaterial));
  return mesh;
}

const ground = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), surfaces.ground.mat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

surfaces.cube.mesh = add(new THREE.BoxGeometry(1.4, 1.4, 1.4), 'cube', -1.25, 0.7, 0.35, { ry: 0.6 });
surfaces.cylinder.mesh = add(new THREE.CylinderGeometry(0.55, 0.55, 2.3, 96), 'cylinder', 0.05, 1.15, -1.0, { hull: true });
surfaces.cone.mesh = add(new THREE.ConeGeometry(0.75, 2.0, 96), 'cone', 1.35, 1.0, -0.35, { hull: true });
surfaces.sphere.mesh = add(new THREE.SphereGeometry(0.7, 128, 64), 'sphere', 0.75, 0.7, 1.35, { hull: true });

// ---------- patterns ----------

function applyPatternTile(key) {
  const s = surfaces[key];
  if (!s.size) return;
  const k = 0.01 * params.patternSize * (s.scale ?? 1);
  s.mat.userData.uniforms.uPatternTile.value.set(s.size.w * k, s.size.h * k);
}

async function setPattern(key, name) {
  surfaces[key].pattern = name;
  surfaces[key].onPattern?.();
  const { tex, w, h } = await loadPattern(name, renderer);
  if (surfaces[key].pattern !== name) return;
  surfaces[key].mat.userData.uniforms.uPattern.value = tex;
  surfaces[key].size = { w, h };
  applyPatternTile(key);
}

Object.entries(surfaces).forEach(([key, s]) => setPattern(key, s.pattern));

// ---------- webcam ----------

const camButton = root.querySelector('.cam-button');
const camSelect = root.querySelector('.cam-select');
const calibrateButton = root.querySelector('.calibrate-button');
const camStatus = root.querySelector('.cam-status');
const preview = root.querySelector('.cam-preview');
const video = root.querySelector('.cam-feed');
const overlay = root.querySelector('.cam-overlay');
const octx = overlay.getContext('2d');

// Small probe for measuring room light and finding the flashlight.
const PW = 160, PH = 120;
const probe = document.createElement('canvas');
probe.width = PW;
probe.height = PH;
const pctx = probe.getContext('2d', { willReadFrequently: true });
const tracker = new TorchTracker(PW, PH);
let lastBlobs = [];

// 2:1 canvas that becomes an equirect environment: blurred room all around,
// the sharp webcam frame in the middle (the direction of the viewer).
const envCanvas = document.createElement('canvas');
envCanvas.width = 512;
envCanvas.height = 256;
const ectx = envCanvas.getContext('2d');
const envTex = new THREE.CanvasTexture(envCanvas);
envTex.mapping = THREE.EquirectangularReflectionMapping;
envTex.colorSpace = THREE.SRGBColorSpace;
const camPmrem = new THREE.PMREMGenerator(renderer);
let camEnvTarget = null;

let camOn = false, mirrored = true, camDeviceId = '';
const room = { color: new THREE.Color(1, 1, 1), lum: 0.5 };
const realTorch = { found: false, u: 0.5, v: 0.5, strength: 0, lastSeen: 0 };

// One Euro filter (Casiez et al.): heavy smoothing while the torch is held
// still, so hand tremor and pixel noise vanish, and little lag once it moves
// fast, because the cutoff rises with speed.
class OneEuro {
  constructor(minCutoff = 0.9, beta = 2.5, dCutoff = 1.0) {
    Object.assign(this, { minCutoff, beta, dCutoff });
    this.reset();
  }
  reset() { this.t = null; }
  static alpha(cutoff, dt) { return 1 / (1 + 1 / (2 * Math.PI * cutoff * dt)); }
  filter(x, t) {
    if (this.t === null) {
      Object.assign(this, { x, dx: 0, t });
      return x;
    }
    const dt = Math.max(t - this.t, 1e-3);
    this.t = t;
    this.dx += OneEuro.alpha(this.dCutoff, dt) * ((x - this.x) / dt - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += OneEuro.alpha(cutoff, dt) * (x - this.x);
    return this.x;
  }
}
const filterU = new OneEuro(), filterV = new OneEuro();
let lastVideoTime = -1;

// What the panel says while the camera starts, learns the room, and waits
// for the phone light.
const MSG = {
  starting: 'Starting the camera...',
  learning: 'Keep your phone light off for a second...',
  point: "Now point your phone's flashlight at the camera.",
};

const CAM_ERRORS = {
  NotAllowedError: 'Camera permission was denied. Allow it in the address bar and try again.',
  SecurityError: 'The webcam only works on https or localhost.',
  NotFoundError: 'No camera was found.',
  OverconstrainedError: 'No camera matched. Try another one from the list.',
  NotReadableError: 'The camera is busy in another app, or blocked by the system.',
  AbortError: 'The camera could not be started. Try again.',
};

function setStatus(text) {
  camStatus.textContent = text;
  camStatus.hidden = !text;
}

// Ask for what we'd like, then for less, then for anything: a camera that
// can't do 640x480 at 30fps still gets used instead of failing.
async function openStream(deviceId) {
  if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
    throw Object.assign(new Error('insecure'), { name: 'SecurityError' });
  }
  const pick = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: 'user' } };
  const attempts = [
    { ...pick, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
    { ...pick },
    deviceId ? { deviceId } : true,
  ];
  let lastError;
  for (const video of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia({ video, audio: false });
    } catch (err) {
      lastError = err;
      if (err.name === 'NotAllowedError' || err.name === 'SecurityError') break;
    }
  }
  throw lastError;
}

// Fill the camera picker; only shown when there's more than one camera.
async function listCameras() {
  if (!navigator.mediaDevices?.enumerateDevices) return;
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
  camSelect.replaceChildren(...cams.map((cam, i) => new Option(cam.label || `Camera ${i + 1}`, cam.deviceId)));
  camSelect.value = camDeviceId;
  camSelect.hidden = cams.length < 2;
}
navigator.mediaDevices?.addEventListener?.('devicechange', () => { if (camOn) listCameras(); });

async function startCam(deviceId = camDeviceId) {
  setStatus('');
  try {
    const stream = await openStream(deviceId);
    video.srcObject?.getTracks().forEach((t) => t.stop());
    video.srcObject = stream;
    await video.play();
    const settings = stream.getVideoTracks()[0]?.getSettings?.() || {};
    camDeviceId = settings.deviceId || deviceId || '';
    // A front camera is shown mirrored, like a mirror; a rear one as it is.
    mirrored = settings.facingMode !== 'environment';
    preview.classList.toggle('is-unmirrored', !mirrored);
    camOn = true;
    lastVideoTime = -1;
    realTorch.found = false;
    tracker.calibrate();
    setStatus(MSG.starting);
    // With the webcam on, the flashlight is the light: the mouse stops being
    // the sun (and the torch), but orbiting still works.
    root.classList.add('is-cam-on');
    camButton.textContent = 'Stop camera';
    camButton.classList.add('is-active');
    // The re-learn button stays hidden for now; calibration still runs on
    // start and from the ?tune panel (which clicks this button).
    preview.classList.add('is-visible');
    listCameras();
    buildCameraControls(stream.getVideoTracks()[0]);
  } catch (err) {
    console.warn(err);
    setStatus(CAM_ERRORS[err.name] || `The camera could not be started (${err.name || err.message}).`);
  }
}

camButton.addEventListener('click', () => (camOn ? stopCam() : startCam()));
camSelect.addEventListener('change', () => startCam(camSelect.value));
calibrateButton.addEventListener('click', () => {
  tracker.calibrate();
  realTorch.found = false;
  setStatus(MSG.learning);
});

function stopCam() {
  video.srcObject?.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  camOn = false;
  realTorch.found = false;
  lastBlobs = [];
  root.classList.remove('is-cam-on');
  camButton.textContent = 'Use your phone as the light';
  camButton.classList.remove('is-active');
  calibrateButton.hidden = true;
  camHardware?.destroy();
  camHardware = null;
  camSelect.hidden = true;
  setStatus('');
  preview.classList.remove('is-visible');
  scene.environment = studioEnv;
}

function analyzeFrame() {
  // Mirrored for a front camera, so moving the torch to your right moves the
  // light to the right.
  pctx.save();
  if (mirrored) {
    pctx.scale(-1, 1);
    pctx.drawImage(video, -PW, 0, PW, PH);
  } else pctx.drawImage(video, 0, 0, PW, PH);
  pctx.restore();

  const t = tracker.settings;
  t.sensitivity = params.sensitivity;
  t.minArea = params.minBlob;
  t.maxArea = params.maxBlob / 100;
  t.preferWhite = params.preferWhite;
  t.useBackground = params.ignoreBackground;

  const res = tracker.analyze(pctx.getImageData(0, 0, PW, PH).data);
  room.color.setRGB(res.room.r, res.room.g, res.room.b, THREE.SRGBColorSpace);
  room.lum = res.room.lum;
  lastBlobs = res.blobs;
  if (res.calibrating) {
    setStatus(res.settling ? MSG.starting : MSG.learning);
    return drawOverlay();
  }

  const now = performance.now() / 1000;
  const blob = params.realTorch ? res.blob : null;
  if (blob) {
    // A fresh sighting after a gap, or a switch to another blob, starts the
    // filters clean, so the light doesn't sweep in from the old spot.
    if (!realTorch.found || blob.switched) { filterU.reset(); filterV.reset(); }
    realTorch.u = filterU.filter(blob.x, now);
    realTorch.v = filterV.filter(blob.y, now);
    realTorch.strength = THREE.MathUtils.lerp(realTorch.strength, Math.min(1, 0.35 + Math.sqrt(blob.area) / 14), 0.2);
    realTorch.lastSeen = now;
  }
  // Hold on through a few dropped frames before letting go.
  realTorch.found = !!blob || (realTorch.found && now - realTorch.lastSeen < 0.35);
  // Keep nudging until the phone light is found; clear once it is.
  setStatus(realTorch.found ? '' : MSG.point);
  if (!realTorch.found && now - realTorch.lastSeen > 1) tracker.forget();

  drawOverlay();
}

// The preview shows what the tracker sees: every candidate blob as a faint
// ring, the chosen one with a crosshair.
function drawOverlay() {
  const w = overlay.width, h = overlay.height;
  octx.clearRect(0, 0, w, h);
  if (tracker.isCalibrating) {
    octx.fillStyle = 'rgba(255, 255, 255, 0.35)';
    octx.fillRect(0, 0, w, h);
    return;
  }
  octx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
  octx.lineWidth = 1;
  for (const blob of lastBlobs) {
    octx.beginPath();
    octx.arc(blob.x * w, blob.y * h, 4 + Math.sqrt(blob.area), 0, Math.PI * 2);
    octx.stroke();
  }
  if (!realTorch.found) return;
  const x = realTorch.u * w, y = realTorch.v * h;
  octx.strokeStyle = '#c0392b';
  octx.lineWidth = 2;
  octx.beginPath();
  octx.arc(x, y, 10, 0, Math.PI * 2);
  octx.moveTo(x - 16, y); octx.lineTo(x - 6, y);
  octx.moveTo(x + 6, y); octx.lineTo(x + 16, y);
  octx.moveTo(x, y - 16); octx.lineTo(x, y - 6);
  octx.moveTo(x, y + 6); octx.lineTo(x, y + 16);
  octx.stroke();
}

function updateCamEnvironment() {
  const W = envCanvas.width, H = envCanvas.height;
  ectx.filter = 'blur(14px)';
  ectx.drawImage(video, -20, -20, W + 40, H + 40);
  ectx.filter = 'none';
  // Sharp frame across ~100deg of the panorama, centred on u = 0.5.
  const fw = W * 0.28, fh = fw * 0.75;
  ectx.globalAlpha = 0.9;
  ectx.drawImage(video, (W - fw) / 2, (H - fh) / 2, fw, fh);
  ectx.globalAlpha = 1;
  envTex.needsUpdate = true;
  camEnvTarget = camPmrem.fromEquirectangular(envTex, camEnvTarget);
  scene.environment = camEnvTarget.texture;
}

// ---------- draggable panel ----------
// Grab the panel by its title to move it out of the way; it stays inside
// the window, also when the window is resized.

const panel = root.querySelector('.panel');
const panelTitle = panel.querySelector('.panel-title');
const EDGE = 8;

function keepPanelInView() {
  const r = panel.getBoundingClientRect();
  panel.style.left = `${THREE.MathUtils.clamp(r.left, EDGE, Math.max(EDGE, innerWidth - r.width - EDGE))}px`;
  panel.style.top = `${THREE.MathUtils.clamp(r.top, EDGE, Math.max(EDGE, innerHeight - Math.min(r.height, 60) - EDGE))}px`;
}

panelTitle.addEventListener('pointerdown', (e) => {
  if (e.button !== 0) return;
  const r = panel.getBoundingClientRect(), dx = e.clientX - r.left, dy = e.clientY - r.top;
  panelTitle.setPointerCapture(e.pointerId);
  panel.classList.add('is-dragging');
  const move = (ev) => {
    panel.style.left = `${ev.clientX - dx}px`;
    panel.style.top = `${ev.clientY - dy}px`;
    keepPanelInView();
  };
  const end = () => {
    panel.classList.remove('is-dragging');
    panelTitle.removeEventListener('pointermove', move);
    panelTitle.removeEventListener('pointerup', end);
    panelTitle.removeEventListener('pointercancel', end);
  };
  panelTitle.addEventListener('pointermove', move);
  panelTitle.addEventListener('pointerup', end);
  panelTitle.addEventListener('pointercancel', end);
  e.preventDefault();
});
addEventListener('resize', keepPanelInView);

// ---------- pointer ----------

const pointer = new THREE.Vector2();
const sunPointer = new THREE.Vector2();
let pointerInside = false, sunPointerSet = false;
renderer.domElement.addEventListener('pointermove', (e) => {
  pointer.set((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  pointerInside = true;
  // The sun holds still while a button is down, so orbiting doesn't drag it.
  if (e.buttons === 0) {
    sunPointer.copy(pointer);
    sunPointerSet = true;
  }
});
renderer.domElement.addEventListener('pointerleave', () => { pointerInside = false; });
const raycaster = new THREE.Raycaster();

// ---------- the sun (key light) follows the mouse ----------
// The cursor is the light. Its ray is cut by a plane facing the camera a
// little in front of the group, and the key light shines from that point, so
// shadows always fall away from the cursor. A pencil-drawn sun sits under it.

const SUN_R = 0.2, SUN_MARGIN = 1.8;
const sunLine = new THREE.LineBasicMaterial({ toneMapped: false });
sunLine.color = draw.uInk.value;
const sunMarker = new THREE.Group();
const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(SUN_R, 48), new THREE.MeshBasicMaterial({ toneMapped: false }));
sunDisc.material.color = draw.uPaper.value;
const ringPts = [], rayPts = [];
for (let i = 0; i < 48; i++) {
  const a = (i / 48) * Math.PI * 2;
  ringPts.push(new THREE.Vector3(Math.cos(a) * SUN_R, Math.sin(a) * SUN_R, 0.001));
}
for (let i = 0; i < 8; i++) {
  const a = (i / 8) * Math.PI * 2, c = Math.cos(a), s = Math.sin(a);
  rayPts.push(new THREE.Vector3(c * SUN_R * 1.45, s * SUN_R * 1.45, 0), new THREE.Vector3(c * SUN_R * 2.1, s * SUN_R * 2.1, 0));
}
sunMarker.add(
  sunDisc,
  new THREE.LineLoop(new THREE.BufferGeometry().setFromPoints(ringPts), sunLine),
  new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rayPts), sunLine)
);

// Dashed construction line from the sun to the group, as on a shadow study.
const sunRayMat = new THREE.LineDashedMaterial({ dashSize: 0.12, gapSize: 0.09, toneMapped: false });
sunRayMat.color = draw.uInk.value;
const sunRay = new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]), sunRayMat);
scene.add(sunMarker, sunRay);

const sunCenter = key.target.position;
const sunDir = new THREE.Vector3(), sunGoal = new THREE.Vector3();
const sunPoint = new THREE.Vector3(), camFwd = new THREE.Vector3();
const sunPlane = new THREE.Plane();
let sunDistance = 4.5, sunDistanceGoal = 4.5;

function setSunFromAngles() {
  const az = THREE.MathUtils.degToRad(params.sunAzimuth), el = THREE.MathUtils.degToRad(params.sunElevation);
  sunGoal.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
}

// The light lives on one upright plane standing in front of the whole group,
// square to the view (it turns with the orbit, never tilts). A screen
// position maps straight onto it: the ray through that position is cut by the
// plane, and the sun shines from that point. Depth is ignored, so moving the
// torch (or cursor) only ever slides the light across this plane.

// How far in front of the orbit target the plane stands: just past the
// nearest corner of the objects' bounding box as seen from this side, plus a
// margin, so the light can never get in among the objects.
const groupBox = new THREE.Box3();
// Recomputed when a solid is resized or lifted (Scene properties).
function refreshGroupBox() {
  groupBox.makeEmpty();
  solids.forEach((mesh) => groupBox.expandByObject(mesh));
}
refreshGroupBox();
const boxCorner = new THREE.Vector3();

function sunPlaneLead(fwd) {
  let lead = 0;
  for (let i = 0; i < 8; i++) {
    boxCorner.set(i & 1 ? groupBox.max.x : groupBox.min.x, i & 2 ? groupBox.max.y : groupBox.min.y, i & 4 ? groupBox.max.z : groupBox.min.z);
    lead = Math.max(lead, -boxCorner.sub(controls.target).dot(fwd));
  }
  return lead + SUN_MARGIN;
}

function setSunFromPointer(ndc) {
  camera.getWorldDirection(camFwd);
  camFwd.y = 0;
  camFwd.normalize();
  sunPlane.setFromNormalAndCoplanarPoint(camFwd, controls.target.clone().addScaledVector(camFwd, -sunPlaneLead(camFwd)));
  raycaster.setFromCamera(ndc, camera);
  if (!raycaster.ray.intersectPlane(sunPlane, sunPoint)) return;
  const d = sunPoint.clone().sub(sunCenter);
  sunDistanceGoal = d.length();
  // Below the table edge the sun would shine from underneath: hold it at 5deg.
  const el = Math.max(Math.asin(d.y / d.length()), THREE.MathUtils.degToRad(5));
  const az = Math.atan2(d.x, d.z);
  sunGoal.set(Math.sin(az) * Math.cos(el), Math.sin(el), Math.cos(az) * Math.cos(el));
  params.sunAzimuth = (THREE.MathUtils.radToDeg(az) + 360) % 360;
  params.sunElevation = THREE.MathUtils.radToDeg(el);
}

// Webcam on: the flashlight's spot in the (mirrored) frame is mapped 1:1 to
// the screen, so the sun appears where the torch appears. A small leash
// keeps a resting hand from wobbling the shadows; the torch has to move past
// it before the light follows.
const leash = new THREE.Vector2(0.5, 0.5);
const torchNdc = new THREE.Vector2();

function setSunFromTorch() {
  const du = realTorch.u - leash.x, dv = realTorch.v - leash.y, dist = Math.hypot(du, dv);
  if (dist > params.torchLeash) {
    const k = 1 - params.torchLeash / dist;
    leash.x += du * k;
    leash.y += dv * k;
  }
  setSunFromPointer(torchNdc.set(leash.x * 2 - 1, 1 - leash.y * 2));
}

function placeSun(dt) {
  if (camOn) {
    // When the torch isn't seen the sun stays where it was and dims (loop).
    if (realTorch.found) setSunFromTorch();
  } else if (params.sunCycle) {
    // The sun walks around the group by itself, overriding the mouse.
    params.sunAzimuth = (params.sunAzimuth + params.sunSpeed * dt) % 360;
    setSunFromAngles();
  } else if (params.mouseSun && sunPointerSet) setSunFromPointer(sunPointer);
  else setSunFromAngles();
  if (sunDir.lengthSq() === 0) sunDir.copy(sunGoal);
  // Frame-rate independent easing: the sun glides rather than snaps.
  const ease = 1 - Math.exp(-dt * (camOn ? 4 : 9));
  const step = sunDir.clone().lerp(sunGoal, ease).normalize();
  // With the flashlight, cap how fast the sun may swing (degrees / second).
  const angle = sunDir.angleTo(step), maxStep = THREE.MathUtils.degToRad(params.torchMaxSpeed) * dt;
  if (camOn && angle > maxStep) sunDir.lerp(step, maxStep / angle).normalize();
  else sunDir.copy(step);
  sunDistance += (sunDistanceGoal - sunDistance) * ease;

  key.position.copy(sunCenter).addScaledVector(sunDir, 14);
  sunMarker.position.copy(sunCenter).addScaledVector(sunDir, sunDistance);
  sunMarker.quaternion.copy(camera.quaternion);
  const pos = sunRay.geometry.attributes.position;
  const a = sunMarker.position.clone().addScaledVector(sunDir, -SUN_R * 2.4);
  const b = sunCenter.clone().addScaledVector(sunDir, 1.6);
  pos.setXYZ(0, a.x, a.y, a.z);
  pos.setXYZ(1, b.x, b.y, b.z);
  pos.needsUpdate = true;
  sunRay.computeLineDistances();
  placePlaneTrace();
}

// Where the light plane meets the table: a dash-dot line, like a section line
// on a drawing, inked on a strip of bare paper so the hatching doesn't swallow
// it. It follows the plane as the view orbits.
const TRACE_LEN = 30;
const dashCanvas = document.createElement('canvas');
dashCanvas.width = 64;
dashCanvas.height = 4;
const dctx = dashCanvas.getContext('2d');
dctx.fillStyle = '#fff';
dctx.fillRect(0, 0, 40, 4); // long dash
dctx.fillRect(48, 0, 6, 4); // dot
const dashTex = new THREE.CanvasTexture(dashCanvas);
dashTex.wrapS = THREE.RepeatWrapping;
dashTex.repeat.set(TRACE_LEN / 0.6, 1);
// No mipmaps: a far, grazing strip would blur the dashes below the alpha cut.
dashTex.generateMipmaps = false;
dashTex.minFilter = THREE.LinearFilter;
dashTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

const flatStrip = (width) => new THREE.PlaneGeometry(TRACE_LEN, width).rotateX(-Math.PI / 2);
const traceHaloMat = new THREE.MeshBasicMaterial({ toneMapped: false, depthWrite: false });
traceHaloMat.color = draw.uPaper.value;
const traceInkMat = new THREE.MeshBasicMaterial({ map: dashTex, alphaTest: 0.3, toneMapped: false, depthWrite: false });
traceInkMat.color = draw.uInk.value;
const planeTrace = new THREE.Group();
const traceHalo = new THREE.Mesh(flatStrip(0.3), traceHaloMat);
const traceInk = new THREE.Mesh(flatStrip(0.07), traceInkMat);
traceHalo.position.y = 0.004;
traceInk.position.y = 0.008;
// Paper strip first, ink on top.
traceHalo.renderOrder = 1;
traceInk.renderOrder = 2;
planeTrace.add(traceHalo, traceInk);
planeTrace.visible = params.showPlane;
scene.add(planeTrace);
const traceFwd = new THREE.Vector3(), traceSide = new THREE.Vector3();

function placePlaneTrace() {
  if (!planeTrace.visible) return;
  camera.getWorldDirection(traceFwd);
  traceFwd.y = 0;
  traceFwd.normalize();
  traceSide.set(-traceFwd.z, 0, traceFwd.x);
  planeTrace.position.copy(controls.target).addScaledVector(traceFwd, -sunPlaneLead(traceFwd)).setY(0);
  planeTrace.rotation.y = Math.atan2(-traceSide.z, traceSide.x);
}

// ---------- per-frame light placement ----------

const right = new THREE.Vector3(), up = new THREE.Vector3(), back = new THREE.Vector3();
const torchPos = new THREE.Vector3(), torchAim = new THREE.Vector3();
const hemiTarget = new THREE.Color(0xdfe8ff);
let torchLevel = 0;

function placeTorch() {
  camera.matrixWorld.extractBasis(right, up, back);
  let level = 0;

  if (params.mouseTorch && pointerInside && !camOn) {
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects([...solids, ground], false)[0];
    torchAim.copy(hit ? hit.point : raycaster.ray.at(8, new THREE.Vector3()));
    torchPos.copy(camera.position).addScaledVector(right, 0.5).addScaledVector(up, -0.35);
    level = 0.8;
  }

  if (level > 0) {
    torch.position.lerp(torchPos, torchLevel > 0.02 ? 0.25 : 1);
    torch.target.position.lerp(torchAim, torchLevel > 0.02 ? 0.25 : 1);
  }
  torchLevel = THREE.MathUtils.lerp(torchLevel, level, 0.15);
  torch.intensity = torchLevel * params.torchPower;
}

function applyRoomLight() {
  if (camOn && params.roomLight) {
    const c = room.color.clone();
    c.multiplyScalar(1 / Math.max(c.r, c.g, c.b, 0.001));
    hemiTarget.copy(c);
    hemi.color.lerp(hemiTarget, 0.08);
    hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, 0.15 + room.lum * 1.4, 0.08);
    key.color.lerp(new THREE.Color(0xfff1e0).lerp(c, 0.35), 0.08);
  } else {
    hemi.color.lerp(hemiTarget.set(0xdfe8ff), 0.08);
    hemi.intensity = THREE.MathUtils.lerp(hemi.intensity, 0.15, 0.08);
    key.color.lerp(new THREE.Color(0xfff1e0), 0.08);
  }
}

// ---------- GUI ----------

// Two panels. The default one is for showing the piece: a handful of
// controls that change the picture at a glance. Add ?tune to the URL for the
// full panel (tone curve, patterns per object, webcam, camera hardware,
// flashlight tracking) to set things up before a presentation.
const tuning = new URLSearchParams(location.search).has('tune');
const gui = new GUI(tuning ? { title: 'Tuning' } : { title: 'Scene properties', container: root.querySelector('.panel') });
let fCam = null;

// Handlers shared by both panels.
const on = {
  orbit: (v) => { controls.autoRotate = v; },
  showSun: (v) => { sunMarker.visible = v; sunRay.visible = v; },
  showPlane: (v) => { planeTrace.visible = v; },
  ink: (v) => { draw.uInk.value.set(v); },
  outlines: (v) => { lineMaterial.visible = v; hullMaterial.visible = v; },
};

if (tuning) buildTuningPanel();
else buildShowPanel();

// The controls that change the picture most, tucked into the instructions
// card under a collapsed "Scene properties" heading: the drawing as a whole,
// then a folded subsection per solid. Built once the pattern list has
// loaded, so the material pickers have their options.
const SOLIDS = ['cube', 'cylinder', 'cone', 'sphere'];

// Palettes from color-palletes/palettes.js (Adobe Color community themes):
// twelve picked to sit well under pencil (pastel, warm, cool, neutral), then
// ten bold ones.
const PALETTES = {
  'Lavender vaporwave': ['aabdff', 'f8d3ad', 'feb3c2', 'ccedce', 'e98688'],
  'Pastel retro': ['fff192', 'eeba89', 'ffc4e5', 'a7c5e8', 'fff8ea'],
  'Color candy': ['eeb3c9', 'f0c6d8', 'dac3e2', 'c7d7e8', '9ab6ce'],
  'Spring': ['7bffba', 'e8de74', 'ffa685', 'dac6e8', '9cf2ff'],
  'Paris in spring': ['fbffff', 'ebc9c0', 'd48392', 'b73736', 'cfaa7d'],
  'Holographic': ['f2529d', '4d578c', '4bbfb4', 'f2ab6d', 'f28a80'],
  'Summer': ['f00817', '2fb0c3', 'bed2db', 'd75103', 'fcc12e'],
  'Primary': ['b21235', 'fff66b', 'ff5672', '149bcc', '0985b2'],
  'Autumn': ['fcaa27', 'f28325', 'bc4001', 'f15516', 'c4823a'],
  'Winter wonderland': ['f3bd94', '294057', 'f4d4c7', 'ebedf4', '919aa5'],
  'Nautical': ['b56152', '749a96', 'dde3c0', '948466', '343434'],
  'Neutral': ['b8b68f', 'ebe6d2', 'dbd3c6', 'decca6', 'd0c0a7'],
  // Bold: the most saturated palettes in the collection, a different hue mix each.
  'Neon vaporwave': ['ff00c1', '0111ff', '9600ff', '00b8ff', '00fff9'],
  'Synthwave pimp': ['ffd944', 'd10bff', 'ff00ff', 'ff8600', '00ffff'],
  'Vaporwave pop': ['01cdfe', 'b967ff', 'ff71ce', '05ffa1', 'fffb96'],
  'Synthwave sunset': ['ffd319', 'ff901f', 'ff2b5c', 'ff3df4', '9a34eb'],
  'Retro neon': ['26ff03', '058aff', 'af0bac', 'ff910d', '8bff06'],
  'Electric retro': ['3b3b3b', '009eff', '68ff48', 'fff249', 'e80c7a'],
  'Shine': ['eff305', 'fdcc12', 'e6921e', 'fd4b08', 'f3142d'],
  'Bold primary': ['2a21ff', 'b3221f', 'ffe91f', '15aab3', '2fff33'],
  'Happy bottle': ['4fb6b8', 'ffd10a', '29d1ff', '00cc23', '54b802'],
  'Sri Lanka': ['ed3d3a', '067dc0', 'a2c548', 'ffe222', 'f1913a'],
};

// Deal a palette's colours out at random to the four solids (through their
// swatches, so the panel shows them too) and the floor. Every deal differs
// from the one before, so picking or reshuffling always changes who gets
// what. Very dark colours are skipped: as a paper tint they'd swallow the
// pencil.
let lastDeal = '';
const WHITE = new THREE.Color(1, 1, 1);

function shuffle(list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function dealPalette(name) {
  const floorTint = surfaces.ground.mat.userData.uniforms.uTint.value;
  if (name === 'none') {
    SOLIDS.forEach((key) => surfaces[key].colorRow?.setValue('#ffffff'));
    floorTint.copy(WHITE);
    lastDeal = '';
    return;
  }
  const hexes = PALETTES[name].filter((h) => new THREE.Color(`#${h}`).getHSL({}, THREE.SRGBColorSpace).l > 0.25).map((h) => `#${h}`);
  let deck = shuffle(hexes);
  for (let tries = 0; tries < 12 && hexes.length > 1 && deck.join() === lastDeal; tries++) deck = shuffle(hexes);
  lastDeal = deck.join();
  SOLIDS.forEach((key, i) => surfaces[key].colorRow?.setValue(deck[i % deck.length]));
  // The floor takes the next colour in the deck, softened toward white so
  // the solids stay the subject.
  floorTint.set(deck[SOLIDS.length % deck.length]).lerp(WHITE, 0.35);
}

// The "add color" picker: a trigger showing the current palette, and a menu
// (fixed to the viewport, so the panel's scrolling can't clip it) listing
// "none" and every palette, each with its colour strip.
function buildPalettePicker(onPick) {
  const strip = (name) => {
    const el = document.createElement('span');
    el.className = 'strip';
    el.replaceChildren(...(PALETTES[name] || []).map((h) => Object.assign(document.createElement('span'), { style: `background:#${h}` })));
    if (!PALETTES[name]) el.classList.add('is-empty');
    return el;
  };
  const label = (name) => Object.assign(document.createElement('span'), { className: 'palette-name', textContent: name });

  const trigger = Object.assign(document.createElement('button'), { type: 'button', className: 'palette-trigger' });
  trigger.setAttribute('aria-haspopup', 'listbox');
  // The trigger shows just the preview strip; the name is its tooltip and label.
  const show = (name) => {
    trigger.replaceChildren(strip(name));
    trigger.title = name;
    trigger.setAttribute('aria-label', `add color: ${name}`);
  };
  show(params.addColor);

  const menu = Object.assign(document.createElement('ul'), { className: 'palette-menu', hidden: true });
  menu.setAttribute('role', 'listbox');
  for (const name of ['none', ...Object.keys(PALETTES)]) {
    const item = Object.assign(document.createElement('button'), { type: 'button', className: 'palette-option' });
    item.setAttribute('role', 'option');
    item.append(strip(name), label(name));
    item.addEventListener('click', () => {
      close();
      show(name);
      onPick(name);
      trigger.focus();
    });
    const li = document.createElement('li');
    li.setAttribute('role', 'presentation');
    li.append(item);
    menu.append(li);
  }
  root.append(menu);

  const place = () => {
    const r = trigger.getBoundingClientRect();
    const below = innerHeight - r.bottom - 12;
    menu.style.left = `${r.left}px`;
    menu.style.width = `${Math.max(r.width, 220)}px`;
    menu.style.maxHeight = `${Math.max(160, below)}px`;
    menu.style.top = `${r.bottom + 4}px`;
  };
  const open = () => {
    place();
    menu.hidden = false;
    trigger.classList.add('is-open');
    trigger.setAttribute('aria-expanded', 'true');
    menu.querySelectorAll('.palette-option').forEach((b) => b.classList.toggle('is-selected', b.textContent === params.addColor));
    (menu.querySelector('.is-selected') || menu.querySelector('.palette-option')).focus();
  };
  const close = () => {
    menu.hidden = true;
    trigger.classList.remove('is-open');
    trigger.setAttribute('aria-expanded', 'false');
  };
  trigger.addEventListener('click', () => (menu.hidden ? open() : close()));
  // Close on Escape or a click elsewhere; arrow keys move through the list.
  addEventListener('pointerdown', (e) => { if (!menu.hidden && !menu.contains(e.target) && !trigger.contains(e.target)) close(); });
  addEventListener('resize', () => { if (!menu.hidden) place(); });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('.palette-option')], i = items.indexOf(document.activeElement);
    if (e.key === 'Escape') { close(); trigger.focus(); }
    if (e.key === 'ArrowDown') { e.preventDefault(); items[Math.min(i + 1, items.length - 1)].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[Math.max(i - 1, 0)].focus(); }
  });
  return trigger;
}

function buildShowPanel() {
  gui.close();
  listPatterns().then((names) => {
    const options = ['none', ...names];
    // A palette to colour the solids with. A native <select> can't show
    // colours, so the row gets its own picker: the button shows the chosen
    // palette as a strip, and its menu lists every palette with its strip.
    // Picking any palette, the current one included, deals it out afresh.
    const colorRow = gui.add(params, 'addColor', ['none', ...Object.keys(PALETTES)]).name('add color');
    colorRow.$widget.replaceChildren(buildPalettePicker((name) => {
      colorRow.setValue(name);
      dealPalette(name);
    }));
    // One material for all four solids; each subsection can override it.
    gui.add(params, 'material', options).onChange((name) => SOLIDS.forEach((key) => setPattern(key, name)));
    gui.add(draw.uContrast, 'value', 0.5, 3, 0.05).name('contrast');
    gui.add(draw.uExposure, 'value', 0.3, 2, 0.01).name('brightness');
    gui.add(draw.uHatchFreq, 'value', 8, 40, 0.5).name('pencil density');
    gui.addColor(params, 'ink').onChange(on.ink);
    gui.add(params, 'outlines').onChange(on.outlines);
    gui.add(params, 'showSun').name('show sun').onChange(on.showSun);

    SOLIDS.forEach((key) => {
      const s = surfaces[key], u = s.mat.userData.uniforms;
      const mesh = s.mesh, restY = mesh.position.y;
      const look = { color: '#ffffff', size: 1, spacing: 1, scale: 1 };
      // Size keeps the solid sitting on the table, and pushes the light plane
      // out if it grows toward the camera.
      const place = () => {
        mesh.scale.setScalar(look.scale);
        mesh.position.y = restY * look.scale;
        refreshGroupBox();
      };
      const f = gui.addFolder(key[0].toUpperCase() + key.slice(1)).close();
      const patternRow = f.add(s, 'pattern', options).onChange((name) => setPattern(key, name)).listen();
      // The colour is a small swatch at the end of the pattern row: its
      // picker is moved there and its own row hidden.
      const colorRow = f.addColor(look, 'color').onChange((v) => u.uTint.value.set(v));
      colorRow.$display.classList.add('swatch');
      colorRow.$display.title = 'paper colour';
      patternRow.$widget.append(colorRow.$display);
      colorRow.hide();
      s.colorRow = colorRow;
      // Pattern scale only means something once there's a pattern.
      const scaleRow = f.add(look, 'size', 0.25, 4, 0.05).name('pattern scale').onChange((v) => {
        s.scale = v;
        applyPatternTile(key);
      });
      s.onPattern = () => scaleRow.show(s.pattern !== 'none');
      s.onPattern();
      f.add(u.uTone, 'value', -0.3, 0.6, 0.01).name('shade');
      f.add(look, 'spacing', 0.4, 2.5, 0.05).name('hatch scale').onChange((v) => { u.uHatchScale.value = 1 / v; });
      f.add(look, 'scale', 0.5, 1.6, 0.01).name('size').onChange(place);
    });
  });
}

function buildTuningPanel() {
  const orbitToggle = gui.add(params, 'autoOrbit').name('auto orbit').onChange(on.orbit);
  controls.addEventListener('start', () => { orbitToggle.setValue(false); });

  const fSun = gui.addFolder('Sun');
  fSun.add(params, 'sunAzimuth', 0, 360, 1).name('azimuth').listen();
  fSun.add(params, 'sunElevation', 3, 88, 0.5).name('elevation').listen();
  fSun.add(params, 'mouseSun').name('mouse is the sun');
  fSun.add(params, 'sunCycle').name('sun cycle');
  fSun.add(params, 'sunSpeed', 1, 60, 1).name('cycle speed');
  fSun.add(params, 'showSun').name('show sun').onChange(on.showSun);
  fSun.add(params, 'showPlane').name('show light plane').onChange(on.showPlane);

  const fDraw = gui.addFolder('Drawing');
  fDraw.addColor(params, 'paper').onChange((v) => {
    draw.uPaper.value.set(v);
    scene.background.set(v);
    scene.fog.color.set(v);
  });
  fDraw.addColor(params, 'ink').onChange(on.ink);
  fDraw.add(params, 'hatching').name('pencil hatching').onChange((v) => { draw.uHatchOn.value = v ? 1 : 0; });
  fDraw.add(params, 'patterns').name('svg patterns').onChange((v) => { draw.uPatternOn.value = v ? 1 : 0; });
  fDraw.add(params, 'outlines').onChange(on.outlines);
  fDraw.add(draw.uExposure, 'value', 0.3, 4, 0.01).name('light to tone');
  fDraw.add(draw.uContrast, 'value', 0.5, 3, 0.05).name('contrast');
  fDraw.add(draw.uHighlight, 'value', 0, 0.6, 0.01).name('highlight tone');
  fDraw.add(surfaces.ground.mat.userData.uniforms.uTone, 'value', 0, 0.8, 0.01).name('table tone');
  fDraw.add(draw.uHatchFreq, 'value', 4, 40, 0.5).name('hatch density');
  fDraw.add(draw.uPatternBase, 'value', 0, 1, 0.01).name('pattern in light');
  fDraw.add(params, 'patternSize', 0.25, 4, 0.05).name('pattern size').onChange(() => Object.keys(surfaces).forEach(applyPatternTile));
  fDraw.add(draw.uWash, 'value', 0, 1, 0.01).name('colour wash');
  fDraw.add(draw.uGrain, 'value', 0, 1, 0.01).name('graphite grain');
  fDraw.add(draw.uLine, 'value', 0, 0.04, 0.001).name('contour weight');

  const fPatterns = gui.addFolder('Surface patterns');
  listPatterns().then((names) => {
    const options = ['none', ...names];
    Object.keys(surfaces).forEach((key) => {
      fPatterns.add(surfaces[key], 'pattern', options).name(key).onChange((name) => setPattern(key, name));
    });
  });

  const fLights = gui.addFolder('Lights').close();
  fLights.add(params, 'keyLight', 0, 6, 0.05).name('key');
  fLights.add(params, 'rimLight', 0, 4, 0.05).name('rim').onChange((v) => { rim.intensity = v; });

  fCam = gui.addFolder('Webcam').close();
  fCam.add(params, 'roomLight').name('room tints light');
  fCam.add(params, 'reflections').name('room in reflections').onChange((v) => { if (!v) scene.environment = studioEnv; });
  fCam.add(params, 'envStrength', 0, 3, 0.05).name('reflection strength');

  // Camera hardware controls, where the browser and camera offer them (mostly
  // Chrome with UVC webcams). Only supported controls are shown. Lowering or
  // locking the exposure stops the camera brightening itself around a torch or
  // a backlit window; every change re-learns the room.
  const fTorch = gui.addFolder('Flashlight').close();
  fTorch.add(params, 'realTorch').name('track real torch');
  fTorch.add(params, 'sensitivity', 1.5, 8, 0.1).name('pickiness');
  fTorch.add(params, 'ignoreBackground').name('ignore room lights');
  fTorch.add({ calibrate: () => calibrateButton.click() }, 'calibrate').name('re-learn the room (torch off)');
  fTorch.add(params, 'minBlob', 1, 60, 1).name('min spot size (px)');
  fTorch.add(params, 'maxBlob', 0.5, 25, 0.5).name('max spot size (%)');
  fTorch.add(params, 'preferWhite', 0, 3, 0.05).name('prefer white light');
  fTorch.add(params, 'torchLeash', 0, 0.15, 0.005).name('steadiness');
  fTorch.add(params, 'torchMaxSpeed', 15, 360, 5).name('max swing speed');
  fTorch.add(params, 'mouseTorch').name('mouse torch');
  fTorch.add(params, 'torchPower', 0, 500, 1).name('power');
  fTorch.add(params, 'torchAngle', 5, 50, 0.5).name('beam angle').onChange((v) => { torch.angle = THREE.MathUtils.degToRad(v); });
  fTorch.add(params, 'torchSoftness', 0, 1, 0.01).name('beam softness').onChange((v) => { torch.penumbra = v; });

}

let camHardware = null;

function buildCameraControls(track) {
  camHardware?.destroy();
  camHardware = null;
  if (!fCam) return;
  camHardware = fCam.addFolder('Camera hardware');
  const caps = track?.getCapabilities?.() || {};
  const now = () => track.getSettings?.() || {};
  const relearn = () => calibrateButton.click();
  const apply = (constraint) => track.applyConstraints({ advanced: [constraint] }).then(relearn).catch((err) => console.warn(err));
  const state = {};
  const range = (key, label, onChange) => {
    const c = caps[key];
    if (!c || c.min === undefined || c.max === undefined || c.min === c.max) return false;
    state[key] = now()[key] ?? c.min;
    camHardware.add(state, key, c.min, c.max, c.step || (c.max - c.min) / 100).name(label).onChange(onChange);
    return true;
  };
  let any = false;
  const modes = caps.exposureMode || [];
  if (modes.includes('manual') && modes.includes('continuous')) {
    state.lock = now().exposureMode === 'manual';
    camHardware.add(state, 'lock').name('lock exposure').onChange((v) => {
      const time = now().exposureTime;
      apply(v ? { exposureMode: 'manual', ...(time ? { exposureTime: time } : {}) } : { exposureMode: 'continuous' });
    });
    any = true;
  }
  any = range('exposureCompensation', 'exposure compensation', (v) => apply({ exposureCompensation: v })) || any;
  if (modes.includes('manual')) any = range('exposureTime', 'exposure time', (v) => apply({ exposureMode: 'manual', exposureTime: v })) || any;
  any = range('brightness', 'brightness', (v) => apply({ brightness: v })) || any;
  any = range('contrast', 'contrast', (v) => apply({ contrast: v })) || any;
  if (!any) camHardware.add({ note: 'not offered by this camera' }, 'note').name('controls').disable();
}

// ---------- loop ----------

let frame = 0;
const clock = new THREE.Clock();
renderer.setAnimationLoop(() => {
  frame++;
  const dt = Math.min(clock.getDelta(), 0.1);
  controls.update();

  placeSun(dt);
  // With the webcam on, the sun is only fully lit while the flashlight is seen.
  const keyGoal = camOn && !realTorch.found ? params.keyLight * 0.25 : params.keyLight;
  key.intensity = THREE.MathUtils.lerp(key.intensity, keyGoal, 0.1);

  if (camOn && video.readyState >= 2) {
    // Only analyse new video frames; the sun eases between them.
    if (video.currentTime !== lastVideoTime) {
      lastVideoTime = video.currentTime;
      analyzeFrame();
    }
    if (params.reflections && frame % 3 === 0) updateCamEnvironment();
  }

  // Keep the webcam panorama facing the viewer, so the reflections show
  // what is actually behind the screen: you.
  scene.environmentRotation.y = controls.getAzimuthalAngle() - Math.PI / 2;
  scene.environmentIntensity = camOn && params.reflections ? 0.4 * params.envStrength : 0.12;

  applyRoomLight();
  placeTorch();
  renderer.render(scene, camera);
});

// Keep the whole group in frame on narrow (portrait) screens by widening the
// vertical field of view as the window gets taller than it is wide.
function fitCamera() {
  camera.aspect = innerWidth / innerHeight;
  const half = Math.tan(THREE.MathUtils.degToRad(17));
  camera.fov = THREE.MathUtils.radToDeg(2 * Math.atan(Math.max(half, (half * 1.3) / camera.aspect)));
  camera.updateProjectionMatrix();
}
fitCamera();

addEventListener('resize', () => {
  fitCamera();
  renderer.setSize(innerWidth, innerHeight);
});
