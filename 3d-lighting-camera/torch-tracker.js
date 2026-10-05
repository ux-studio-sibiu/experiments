// Finds a flashlight in small webcam frames, in plain JavaScript on the
// pixels, so it works with any camera and any browser.
//
//  1. Adaptive threshold: a pixel counts as bright when it stands far above
//     this frame's own average (mean + k * spread), so auto-exposure and
//     different cameras don't break a fixed cut-off.
//  2. Background model: a slowly updating picture of the room. Only pixels
//     much brighter than the background count, so lamps, windows and screens
//     that are always there are ignored. calibrate() records it afresh.
//  3. Every bright blob is found and scored (brightness above background,
//     clipped white core, colourlessness, roundness, size), not just the
//     brightest pixel.
//  4. Continuity: the tracked blob is preferred; a different one has to win
//     for several frames in a row before the tracker switches to it.

export class TorchTracker {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    const n = w * h;
    this.lum = new Float32Array(n);
    this.chroma = new Float32Array(n);
    this.bg = new Float32Array(n);
    this.mask = new Uint8Array(n);
    this.label = new Int32Array(n);
    this.stack = new Int32Array(n);
    this.chosen = new Uint8Array(n);
    this.settings = {
      sensitivity: 3.5, // k in mean + k * spread
      minDelta: 0.18, // how much brighter than the background a pixel must be
      useBackground: true,
      bgAdapt: 0.01, // per-frame learning rate of the background
      minArea: 4, // px in the probe frame
      maxArea: 0.06, // fraction of the frame
      preferWhite: 1,
      switchFrames: 4,
    };
    this.calibrate();
  }

  // Record the background afresh (torch off). Webcams spend a second or two
  // settling their auto-exposure after they start or after a big change, so
  // first wait until the frame's brightness holds steady (up to maxWarmup
  // frames), then average `frames` frames.
  calibrate(frames = 24, maxWarmup = 90) {
    this.warmup = maxWarmup;
    this.steady = 0;
    this.prevMean = -1;
    this.calibrating = frames;
    this.calibrated = 0;
    this.track = null;
    this.challenger = null;
  }

  get isCalibrating() { return this.warmup > 0 || this.calibrating > 0; }
  get isSettling() { return this.warmup > 0; }

  // What a background pixel should read at the camera's current exposure.
  // Clipped pixels (a window, a lamp) stay clipped whatever the exposure.
  expected(p, gain) {
    const b = this.bg[p];
    return b > 0.94 ? 1 : Math.min(1, b * gain);
  }

  analyze(data) {
    const { w, h, lum, chroma, bg, mask, settings: s } = this;
    const n = w * h;

    // Luminance, chroma, frame statistics and the room's average colour.
    let sum = 0, sum2 = 0, r = 0, g = 0, b = 0;
    for (let i = 0, p = 0; p < n; i += 4, p++) {
      const R = data[i] / 255, G = data[i + 1] / 255, B = data[i + 2] / 255;
      const L = 0.2126 * R + 0.7152 * G + 0.0722 * B;
      lum[p] = L;
      chroma[p] = Math.max(R, G, B) - Math.min(R, G, B);
      sum += L;
      sum2 += L * L;
      r += R; g += G; b += B;
    }
    const mean = sum / n;
    const spread = Math.sqrt(Math.max(sum2 / n - mean * mean, 1e-6));
    const room = { r: r / n, g: g / n, b: b / n, lum: mean };

    // Wait for auto-exposure to settle: brightness steady for 10 frames.
    if (this.warmup > 0) {
      this.steady = Math.abs(mean - this.prevMean) < 0.006 ? this.steady + 1 : 0;
      this.prevMean = mean;
      this.warmup = this.steady >= 10 ? 0 : this.warmup - 1;
      return { room, blob: null, blobs: [], calibrating: true, settling: true };
    }

    // Background: averaged while calibrating, remembering how bright the
    // frame was then (bgMean) to compensate later exposure changes.
    if (this.calibrating > 0) {
      const k = 1 / ++this.calibrated;
      for (let p = 0; p < n; p++) bg[p] += (lum[p] - bg[p]) * k;
      if (--this.calibrating === 0) this.bgMean = Math.max(bg.reduce((a, v) => a + v, 0) / n, 0.02);
      return { room, blob: null, blobs: [], calibrating: true };
    }

    // The camera brightens or darkens the whole picture on its own: scale the
    // background by the same amount before comparing, and learn it slowly
    // (at the reference exposure), except under the tracked torch, so holding
    // it still doesn't fade it away.
    const gain = Math.min(Math.max(mean / this.bgMean, 0.5), 2);
    for (let p = 0; p < n; p++) if (!this.chosen[p]) bg[p] += (Math.min(1, lum[p] / gain) - bg[p]) * s.bgAdapt;

    // Candidate pixels: far above the frame average (capped, so a clipped
    // torch still passes in a bright frame) and above the background.
    const t = Math.min(mean + s.sensitivity * spread, 0.97);
    for (let p = 0; p < n; p++) {
      const L = lum[p];
      mask[p] = L > t && (!s.useBackground || L - this.expected(p, gain) > s.minDelta) ? 1 : 0;
    }

    const blobs = this.findBlobs(t, gain);
    const pick = this.choose(blobs);

    this.chosen.fill(0);
    if (pick) for (let p = 0; p < n; p++) if (this.label[p] === pick.id) this.chosen[p] = 1;
    return { room, blob: pick, blobs, calibrating: false, gain };
  }

  // 4-connected components on the mask, with the stats each blob is scored on.
  findBlobs(t, gain) {
    const { w, h, lum, chroma, bg, mask, label, stack, settings: s } = this;
    const n = w * h;
    label.fill(0);
    const blobs = [];
    let id = 0;
    for (let start = 0; start < n; start++) {
      if (!mask[start] || label[start]) continue;
      id++;
      let top = 0, area = 0, sx = 0, sy = 0, sw = 0, sumDelta = 0, sumChroma = 0, core = 0;
      let x0 = w, x1 = 0, y0 = h, y1 = 0;
      stack[top++] = start;
      label[start] = id;
      while (top) {
        const p = stack[--top];
        const x = p % w, y = (p / w) | 0;
        const L = lum[p], wgt = L - t + 0.02;
        area++;
        sx += x * wgt; sy += y * wgt; sw += wgt;
        sumDelta += L - this.expected(p, gain);
        sumChroma += chroma[p];
        if (L > 0.97) core++;
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
        if (x > 0 && mask[p - 1] && !label[p - 1]) { label[p - 1] = id; stack[top++] = p - 1; }
        if (x < w - 1 && mask[p + 1] && !label[p + 1]) { label[p + 1] = id; stack[top++] = p + 1; }
        if (y > 0 && mask[p - w] && !label[p - w]) { label[p - w] = id; stack[top++] = p - w; }
        if (y < h - 1 && mask[p + w] && !label[p + w]) { label[p + w] = id; stack[top++] = p + w; }
      }
      if (area < s.minArea || area > s.maxArea * n) continue;

      const bw = x1 - x0 + 1, bh = y1 - y0 + 1;
      const fill = area / (bw * bh); // a disc fills ~0.785 of its box
      const aspect = Math.min(bw, bh) / Math.max(bw, bh);
      const blob = {
        id, area,
        x: (sx / sw + 0.5) / w,
        y: (sy / sw + 0.5) / h,
        delta: sumDelta / area,
        white: 1 - Math.min(1, (sumChroma / area) * 2.5),
        core: core / area,
        round: Math.max(0, 1 - Math.abs(fill - 0.785) * 1.6) * aspect,
      };
      blob.base = blob.delta * 1.5 + blob.core * 0.8 + blob.white * 0.6 * s.preferWhite + blob.round * 0.4
        + 0.15 * Math.log(area) / Math.log(s.maxArea * n);
      blobs.push(blob);
    }
    return blobs;
  }

  // Best blob, with a pull toward the tracked one and a waiting period before
  // switching to a different one.
  choose(blobs) {
    if (!blobs.length) {
      this.challenger = null;
      return null;
    }
    const near = (blob) => this.track ? Math.exp(-Math.hypot(blob.x - this.track.x, blob.y - this.track.y) / 0.12) : 0;
    for (const blob of blobs) blob.score = blob.base + near(blob) * 1.2;
    blobs.sort((a, b) => b.score - a.score);
    const best = blobs[0];

    const isTracked = (blob) => this.track && Math.hypot(blob.x - this.track.x, blob.y - this.track.y) < 0.12;
    if (!this.track || isTracked(best)) {
      this.challenger = null;
      this.track = { x: best.x, y: best.y };
      return best;
    }

    // A different blob is winning: only switch once it has kept winning.
    const same = this.challenger && Math.hypot(best.x - this.challenger.x, best.y - this.challenger.y) < 0.12;
    this.challenger = { x: best.x, y: best.y, frames: same ? this.challenger.frames + 1 : 1 };
    if (this.challenger.frames >= this.settings.switchFrames) {
      this.challenger = null;
      this.track = { x: best.x, y: best.y };
      best.switched = true;
      return best;
    }
    const tracked = blobs.find(isTracked);
    if (tracked) this.track = { x: tracked.x, y: tracked.y };
    return tracked || null;
  }

  // The tracker lost the torch for good (the caller decides when).
  forget() {
    this.track = null;
    this.challenger = null;
  }
}
