/* artboard — the fixed design space the cover is drawn in.
   A 1600x900 box scaled to the viewport by the same max(vw/w, vh/h) that
   `background-size: cover` computes, so type and photograph share one
   transform and every stored number is resolution-independent. */

/* ============================ the artboard ============================
   Everything on the cover is laid out in a fixed REF.w x REF.h space and the
   whole box is scaled to the viewport by max(vw/w, vh/h) — the same number
   `background-size: cover` computes, which is why a box scaled by it covers the
   window exactly. One transform for the scene means the type can never drift
   against the photograph, and every stored number is resolution-independent.
   ===================================================================== */
const REF = { w: 1600, h: 900 };
let sceneScale = 1;

/* ---- the safe area: the part of the artboard this window actually shows ----
   Cover-scaling shows the middle of the artboard in whichever direction the
   window is proportionally shorter:

     a viewport WIDER than the artboard  -> crops top and bottom, keeps refA/a of the height
     a viewport NARROWER than it         -> crops the sides,       keeps a/refA of the width

   Measured against the window you are sitting at, that is exactly the region
   visible right now — the same fraction a `contain` fit would have shown,
   min(vw/w,vh/h) / max(vw/w,vh/h) — and it is the roomiest bound there is.

   Worth knowing what it does NOT claim: it says what YOU can see, not what a
   viewer with a differently shaped window will. Design to its edges at 1.85:1
   and an ultrawide visitor still loses about 12% off the top and bottom. */
function fitSafeArea() {
  const el = $('safeArea'); if (!el) return;
  const refA = REF.w / REF.h, a = innerWidth / innerHeight;
  const wFrac = Math.min(a, refA) / refA;
  const hFrac = refA / Math.max(a, refA);
  el.style.setProperty('--safe-x', (1 - wFrac) / 2 * 100 + '%');
  el.style.setProperty('--safe-y', (1 - hFrac) / 2 * 100 + '%');
  const label = el.querySelector('span');
  if (label) label.textContent = `visible now · ${Math.round(wFrac*100)}% × ${Math.round(hFrac*100)}%`;
}

function fitScene() {
  sceneScale = Math.max(innerWidth / REF.w, innerHeight / REF.h);
  document.documentElement.style.setProperty('--scene-scale', sceneScale);
  const out = $('sceneFit');
  if (out) out.value = `${REF.w}×${REF.h} · ${sceneScale.toFixed(2)}×`;
  fitSafeArea();
  queueFrame();               // the scale changed, so every block's box moved
}
// The reference box is read from the scene file, not hardcoded at load, so a
// later change of default cannot invalidate scenes saved against the old one.
function setRef(w, h) {
  if (!(w > 0 && h > 0)) return;
  REF.w = w; REF.h = h;
  document.documentElement.style.setProperty('--ref-w', w + 'px');
  document.documentElement.style.setProperty('--ref-h', h + 'px');
  fitScene();
}
