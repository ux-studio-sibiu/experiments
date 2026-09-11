/* Background Experiments - SVG patterns app logic.
   Depends on: patterns.js (PATTERNS, CATEGORIES, loadPattern, byName) */

/* ============================ state ============================ */
const state = {
  targetSelector: 'section.stage',
  targetBgColor: '#0b0b0d',
  targetBgAlpha: 1,
  bgImage: { url: null, fit: 'cover' },
  pattern: { name: 'polka-dots', scale: 2, opacity: 0.5, color: '#000000', blend: 'multiply', rotate: 0 },
  pattern2: { enabled: false, name: 'stripes', scale: 1.5, opacity: 0.3, color: '#ffffff', blend: 'screen', rotate: 45 },
};

const locks = { pattern: false, pattern2: false };

// Style element for pseudo-element rules
let styleEl = document.createElement('style');
styleEl.id = 'pattern-styles';
document.head.appendChild(styleEl);

/* ============================ element selector generation ============================ */
function getElementSelector(el) {
  if (el.id) return '#' + el.id;

  const classes = Array.from(el.classList).filter(c => c && !c.startsWith('_')).join('.');
  if (classes) return el.tagName.toLowerCase() + '.' + classes;

  // Build path from element to root
  let path = [];
  let current = el;
  while (current && current !== document.body && current !== document.documentElement) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      selector = '#' + current.id;
      path.unshift(selector);
      break;
    }
    const classes = Array.from(current.classList).filter(c => c && !c.startsWith('_')).join('.');
    if (classes) selector += '.' + classes;
    path.unshift(selector);
    current = current.parentElement;
  }

  return path.join(' > ');
}

// SVG dimension cache
const svgDimensions = {};


async function getSVGDimensions(name) {
  if (svgDimensions[name]) return svgDimensions[name];

  try {
    const response = await fetch(`patterns/${name}.svg`);
    const svg = await response.text();

    // Extract viewBox
    const viewBoxMatch = svg.match(/viewBox\s*=\s*["']([^"']+)["']/i);
    if (viewBoxMatch) {
      const parts = viewBoxMatch[1].split(/[\s,]+/).map(Number);
      const w = parts[2];
      const h = parts[3];
      if (w && h) {
        svgDimensions[name] = { width: w, height: h };
        return svgDimensions[name];
      }
    }
  } catch (e) {
    console.error(`Could not get SVG dimensions for ${name}`, e);
  }

  // Default fallback
  return svgDimensions[name] = { width: 20, height: 20 };
}

// Ctrl+click to select element
document.addEventListener('click', (e) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault();
    e.stopPropagation();
    const selector = getElementSelector(e.target);
    state.targetSelector = selector;
    $('targetSelector').value = selector;
    render().catch(console.error);
  }
}, true);
const $ = (id) => document.getElementById(id);
const fmt = (v) => (+v).toFixed(3).replace(/0+$/,'').replace(/\.$/,'');

/* ============================ populate selects ============================ */
function buildPatternSelects() {
  const html = PATTERNS.map(p => `<option value="${p.n}">${p.n}</option>`).join('');
  $('patternSelect').innerHTML = html;
  $('pattern2Select').innerHTML = html;
}

buildPatternSelects();

/* ============================ pseudo-element CSS generation ============================ */
async function generatePseudoElementCSS() {
  let css = '';

  if (state.targetSelector) {
    // Target element background color, image, and position context
    // Convert hex color to rgba with alpha
    const hex = state.targetBgColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const bgColorCSS = `rgba(${r}, ${g}, ${b}, ${state.targetBgAlpha})`;

    let bgCSS = `${state.targetSelector} {
  background-color: ${bgColorCSS};
  position: relative;
  overflow: hidden;`;

    if (state.bgImage.url) {
      bgCSS += `
  background-image: url('${state.bgImage.url}');
  background-size: ${state.bgImage.fit === 'auto' ? 'auto' : state.bgImage.fit};
  background-repeat: ${state.bgImage.fit === 'auto' ? 'repeat' : 'no-repeat'};`;
    }

    bgCSS += `
}\n`;
    css += bgCSS;

    // Pattern 1 (::before)
    const dim1 = await getSVGDimensions(state.pattern.name);
    const width1 = Math.round(dim1.width * state.pattern.scale);
    const height1 = Math.round(dim1.height * state.pattern.scale);

    css += `${state.targetSelector}::before {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background-color: ${state.pattern.color};
  -webkit-mask-image: url('patterns/${state.pattern.name}.svg');
  mask-image: url('patterns/${state.pattern.name}.svg');
  -webkit-mask-size: ${width1}px ${height1}px;
  mask-size: ${width1}px ${height1}px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-position: 0 0;
  mask-position: 0 0;
  opacity: ${state.pattern.opacity};
  mix-blend-mode: ${state.pattern.blend};
  transform: rotate(${state.pattern.rotate}deg);
  pointer-events: none;
  z-index: 1;
}\n`;

    // Pattern 2 (::after)
    if (state.pattern2.enabled) {
      const dim2 = await getSVGDimensions(state.pattern2.name);
      const width2 = Math.round(dim2.width * state.pattern2.scale);
      const height2 = Math.round(dim2.height * state.pattern2.scale);

      css += `${state.targetSelector}::after {
  content: '';
  position: absolute;
  top: -50%;
  left: -50%;
  width: 200%;
  height: 200%;
  background-color: ${state.pattern2.color};
  -webkit-mask-image: url('patterns/${state.pattern2.name}.svg');
  mask-image: url('patterns/${state.pattern2.name}.svg');
  -webkit-mask-size: ${width2}px ${height2}px;
  mask-size: ${width2}px ${height2}px;
  -webkit-mask-repeat: repeat;
  mask-repeat: repeat;
  -webkit-mask-position: 0 0;
  mask-position: 0 0;
  opacity: ${state.pattern2.opacity};
  mix-blend-mode: ${state.pattern2.blend};
  transform: rotate(${state.pattern2.rotate}deg);
  pointer-events: none;
  z-index: 2;
}\n`;
    }
  }

  return css;
}

/* ============================ render state ============================ */
async function render() {
  styleEl.textContent = await generatePseudoElementCSS();
}

/* ============================ UI bindings ============================ */
function bindControls() {
  // Target selector
  $('targetSelector').value = state.targetSelector;
  $('targetSelector').addEventListener('change', (e) => {
    state.targetSelector = e.target.value;
    render().catch(console.error);
  });

  // Target background color
  $('targetBgColor').value = state.targetBgColor;
  $('targetBgColor').addEventListener('change', (e) => {
    state.targetBgColor = e.target.value;
    render().catch(console.error);
  });

  // Target background alpha
  $('targetBgAlpha').value = state.targetBgAlpha;
  $('targetBgAlpha').addEventListener('input', (e) => {
    state.targetBgAlpha = parseFloat(e.target.value);
    $('targetBgAlphaV').textContent = fmt(state.targetBgAlpha);
    render().catch(console.error);
  });

  // Background image - random photo
  $('bgRandomPhoto').addEventListener('click', () => {
    const random = Math.random().toString(36).substring(2, 11);
    state.bgImage.url = `https://picsum.photos/1600/900?random=${random}`;
    render().catch(console.error);
  });

  // Background image - upload
  $('bgUpload').addEventListener('click', () => {
    $('bgImageUpload').click();
  });

  $('bgImageUpload').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        state.bgImage.url = event.target.result;
        render().catch(console.error);
      };
      reader.readAsDataURL(file);
    }
  });

  // Background image - fit
  $('bgImageFit').value = state.bgImage.fit;
  $('bgImageFit').addEventListener('change', (e) => {
    state.bgImage.fit = e.target.value;
    render().catch(console.error);
  });

  // Pattern 1
  $('patternSelect').value = state.pattern.name;
  $('patternSelect').addEventListener('change', (e) => {
    state.pattern.name = e.target.value;
    render().catch(console.error);
  });

  $('patternScale').value = state.pattern.scale;
  $('patternScale').addEventListener('input', (e) => {
    state.pattern.scale = parseFloat(e.target.value);
    $('patternScaleV').textContent = fmt(state.pattern.scale);
    render().catch(console.error);
  });

  $('patternOpacity').value = state.pattern.opacity;
  $('patternOpacity').addEventListener('input', (e) => {
    state.pattern.opacity = parseFloat(e.target.value);
    $('patternOpacityV').textContent = fmt(state.pattern.opacity);
    render().catch(console.error);
  });

  $('patternColor').value = state.pattern.color;
  $('patternColor').addEventListener('change', (e) => {
    state.pattern.color = e.target.value;
    render().catch(console.error);
  });

  $('patternBlend').value = state.pattern.blend;
  $('patternBlend').addEventListener('change', (e) => {
    state.pattern.blend = e.target.value;
    render().catch(console.error);
  });

  $('patternRotate').value = state.pattern.rotate;
  $('patternRotate').addEventListener('input', (e) => {
    state.pattern.rotate = parseInt(e.target.value);
    $('patternRotateV').textContent = state.pattern.rotate + '°';
    render().catch(console.error);
  });

  // Pattern 2
  $('pattern2Enabled').checked = state.pattern2.enabled;
  $('pattern2Enabled').addEventListener('change', (e) => {
    state.pattern2.enabled = e.target.checked;
    $('pattern2-config').style.display = e.target.checked ? 'block' : 'none';
    render().catch(console.error);
  });

  $('pattern2Select').value = state.pattern2.name;
  $('pattern2Select').addEventListener('change', (e) => {
    state.pattern2.name = e.target.value;
    render().catch(console.error);
  });

  $('pattern2Scale').value = state.pattern2.scale;
  $('pattern2Scale').addEventListener('input', (e) => {
    state.pattern2.scale = parseFloat(e.target.value);
    $('pattern2ScaleV').textContent = fmt(state.pattern2.scale);
    render().catch(console.error);
  });

  $('pattern2Opacity').value = state.pattern2.opacity;
  $('pattern2Opacity').addEventListener('input', (e) => {
    state.pattern2.opacity = parseFloat(e.target.value);
    $('pattern2OpacityV').textContent = fmt(state.pattern2.opacity);
    render().catch(console.error);
  });

  $('pattern2Color').value = state.pattern2.color;
  $('pattern2Color').addEventListener('change', (e) => {
    state.pattern2.color = e.target.value;
    render().catch(console.error);
  });

  $('pattern2Blend').value = state.pattern2.blend;
  $('pattern2Blend').addEventListener('change', (e) => {
    state.pattern2.blend = e.target.value;
    render().catch(console.error);
  });

  $('pattern2Rotate').value = state.pattern2.rotate;
  $('pattern2Rotate').addEventListener('input', (e) => {
    state.pattern2.rotate = parseInt(e.target.value);
    $('pattern2RotateV').textContent = state.pattern2.rotate + '°';
    render().catch(console.error);
  });

}

bindControls();

/* ============================ randomize ============================ */
function randomValue(min, max) {
  return Math.random() * (max - min) + min;
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1) + min);
}

function randomChoice(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomPattern() {
  if (locks.pattern) return;
  state.pattern.name = randomChoice(PATTERNS).n;
  state.pattern.scale = randomValue(0.5, 4);
  state.pattern.opacity = randomValue(0.2, 0.8);
  state.pattern.color = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
  state.pattern.blend = randomChoice(['multiply', 'screen', 'overlay', 'darken', 'lighten', 'normal']);
  state.pattern.rotate = randomInt(0, 3) * 90;
}

function randomPattern2() {
  if (locks.pattern2) return;
  state.pattern2.enabled = Math.random() > 0.4;
  state.pattern2.name = randomChoice(PATTERNS).n;
  state.pattern2.scale = randomValue(0.5, 4);
  state.pattern2.opacity = randomValue(0.1, 0.6);
  state.pattern2.color = `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`;
  state.pattern2.blend = randomChoice(['multiply', 'screen', 'overlay', 'darken', 'lighten', 'normal']);
  state.pattern2.rotate = randomInt(0, 3) * 90;
}

function randomizeAll() {
  // Optionally randomize background image (50% chance)
  if (Math.random() > 0.5) {
    const random = Math.random().toString(36).substring(2, 11);
    state.bgImage.url = `https://picsum.photos/1600/900?random=${random}`;
  }
  randomPattern();
  randomPattern2();
  updateUI();
  render().catch(console.error);
}

function updateUI() {
  // Update all control values to match state
  $('targetSelector').value = state.targetSelector;
  $('targetBgColor').value = state.targetBgColor;
  $('targetBgAlpha').value = state.targetBgAlpha;
  $('targetBgAlphaV').textContent = fmt(state.targetBgAlpha);
  $('bgImageFit').value = state.bgImage.fit;
  $('patternSelect').value = state.pattern.name;
  $('patternScale').value = state.pattern.scale;
  $('patternScaleV').textContent = fmt(state.pattern.scale);
  $('patternOpacity').value = state.pattern.opacity;
  $('patternOpacityV').textContent = fmt(state.pattern.opacity);
  $('patternColor').value = state.pattern.color;
  $('patternBlend').value = state.pattern.blend;
  $('patternRotate').value = state.pattern.rotate;
  $('patternRotateV').textContent = state.pattern.rotate + '°';

  $('pattern2Enabled').checked = state.pattern2.enabled;
  $('pattern2-config').style.display = state.pattern2.enabled ? 'block' : 'none';
  $('pattern2Select').value = state.pattern2.name;
  $('pattern2Scale').value = state.pattern2.scale;
  $('pattern2ScaleV').textContent = fmt(state.pattern2.scale);
  $('pattern2Opacity').value = state.pattern2.opacity;
  $('pattern2OpacityV').textContent = fmt(state.pattern2.opacity);
  $('pattern2Color').value = state.pattern2.color;
  $('pattern2Blend').value = state.pattern2.blend;
  $('pattern2Rotate').value = state.pattern2.rotate;
  $('pattern2RotateV').textContent = state.pattern2.rotate + '°';
}

/* ============================ button handlers ============================ */
$('randomize').addEventListener('click', randomizeAll);

// Randomize section buttons
document.querySelectorAll('[data-rand]').forEach(btn => {
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const target = btn.dataset.rand;
    if (target === 'pattern') randomPattern();
    else if (target === 'pattern2') randomPattern2();
    updateUI();
    render().catch(console.error);
  });
});

// Lock buttons
document.querySelectorAll('[data-lock]').forEach(btn => {
  const target = btn.dataset.lock;
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    locks[target] = !locks[target];
    btn.setAttribute('aria-pressed', locks[target]);
    btn.textContent = locks[target] ? '🔒' : '🔓';
  });
});

// Keyboard shortcut
document.addEventListener('keydown', (e) => {
  if (e.key === 'r' || e.key === 'R') {
    if (document.activeElement.contentEditable !== 'true') {
      randomizeAll();
    }
  }
});

// Panel toggle
$('panelToggle').addEventListener('click', () => {
  const panel = $('panel');
  panel.classList.toggle('hidden');
  $('panelShow').classList.toggle('visible');
});

$('panelShow').addEventListener('click', () => {
  const panel = $('panel');
  panel.classList.remove('hidden');
  $('panelShow').classList.remove('visible');
});

// Copy CSS button
$('copyCSS').addEventListener('click', () => {
  const css = `/* SVG Pattern Background */
#patternLayer {
  background-image: url('data:image/svg+xml;utf8,...');
  background-size: ${state.pattern.scale * 20}px ${state.pattern.scale * 20}px;
  background-repeat: repeat;
  opacity: ${state.pattern.opacity};
  mix-blend-mode: ${state.pattern.blend};
  transform: rotate(${state.pattern.rotate}deg);
}

/* Background Color */
#bgLayer {
  background-color: ${state.bg.color};
}`;

  navigator.clipboard.writeText(css).then(() => {
    alert('CSS copied to clipboard!');
  });
});

// Initial render
render().catch(console.error);
updateUI();
