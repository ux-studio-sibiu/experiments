// geometry.js - the drawing as edges, and the closed areas they make.
//
// The curves (polylines and circle arcs, open or closed, in window pixels) are cut wherever they cross, themselves
// included, giving a network of edges: nodes at the crossings and at loose ends, straight or curved pieces between.
// Pieces with a loose end (a line stopping in mid-area, the stub left by a trim) bound nothing, so they are peeled
// away before tracing. Walking what remains, always turning the same way at a node, traces the boundary of every
// closed area; an area with another group of curves inside it gets that group's outline as a hole. The areas are what
// cubism calls screens.
//
// Only straight segments and circle arcs exist here (a trimmed circle is an arc), so every crossing is exact
// closed-form maths: no curve library. Curved pieces are kept as fine polylines (a point every ~3 px), which is
// sub-pixel accurate for clipping, and both areas either side of a piece share the very same points.
//
// arrangement(curves) -> { faces, pieces }
//   curves: [{ kind: 'poly', points: [[x, y], ...], closed } | { kind: 'arc', cx, cy, r, a0, a1, closed }]
//           (an arc runs from angle a0 to a1 > a0; a whole circle is a0 .. a0 + 2pi with closed: true)
//   faces:  [{ rings, area, cx, cy, ix, iy, box }] - rings: the outer boundary first, then holes, filled even-odd;
//           cx, cy the centroid; ix, iy a point surely inside
//   pieces: [{ curve, s0, s1, points }] - every piece between crossings, loose ones included (to pick and trim):
//           curve is the index into curves, s0 .. s1 the stretch along it (s1 may pass the end of a closed curve)

// Crossings closer than this are the same node. Kept tiny on purpose: merging crossings that are merely near turns
// a crossing into a touch and scrambles the order of edges at the node. Near-coincident crossings stay separate
// nodes joined by very short pieces, which is fine because edges are ordered by their exact direction (below).
const EPS = 0.01;
const ARC_STEP = 3; // px between points on a curved piece
const TAU = 2 * Math.PI;

// ---- curves as a length parameter s, 0 .. length, walked in drawing order ----
function prepare(c) {
  if (c.kind === 'arc') return { ...c, closed: !!c.closed, length: c.r * (c.a1 - c.a0) };
  const n = c.points.length, segs = c.closed ? n : n - 1, cum = [0];
  for (let i = 0; i < segs; i++) cum.push(cum[i] + Math.hypot(c.points[(i + 1) % n][0] - c.points[i][0], c.points[(i + 1) % n][1] - c.points[i][1]));
  return { ...c, closed: !!c.closed, segs, cum, length: cum[segs] };
}

const norm = (o, s) => (o.closed ? ((s % o.length) + o.length) % o.length : Math.min(Math.max(s, 0), o.length));

// the polyline segment s falls in: forward (s at a corner belongs to the segment after it) or arriving (before it)
function segmentAt(o, s, arriving) {
  let i = 0;
  if (arriving) {
    while (i < o.segs - 1 && o.cum[i + 1] < s) i++;
    if (o.closed && s === 0) i = o.segs - 1;
  } else {
    while (i < o.segs - 1 && o.cum[i + 1] <= s) i++;
  }
  return i;
}

function pointAt(o, s) {
  s = norm(o, s);
  if (o.kind === 'arc') {
    const a = o.a0 + s / o.r;
    return [o.cx + o.r * Math.cos(a), o.cy + o.r * Math.sin(a)];
  }
  const i = segmentAt(o, s, false), a = o.points[i], b = o.points[(i + 1) % o.points.length];
  const t = (s - o.cum[i]) / (o.cum[i + 1] - o.cum[i] || 1);
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// The exact direction of travel at s, as an angle: leaving s forward (the side or tangent just after it), or arriving
// at s (the side or tangent just before it). At a corner the two differ, which is what makes a crossing exactly on a
// corner come out right.
function directionAt(o, s, arriving) {
  s = norm(o, s);
  if (o.kind === 'arc') {
    const a = o.a0 + s / o.r;
    return Math.atan2(Math.cos(a), -Math.sin(a)); // increasing s turns the way the angle grows
  }
  const i = segmentAt(o, s, arriving), a = o.points[i], b = o.points[(i + 1) % o.points.length];
  return Math.atan2(b[1] - a[1], b[0] - a[0]);
}

// the points of the stretch s0 .. s1 (on a closed curve s1 may pass the end and wrap): ends, corners, arc points
function samplePiece(o, s0, s1) {
  const points = [pointAt(o, s0)];
  if (o.kind === 'arc') {
    const steps = Math.max(1, Math.ceil((s1 - s0) / ARC_STEP));
    for (let k = 1; k < steps; k++) points.push(pointAt(o, s0 + ((s1 - s0) * k) / steps));
  } else {
    for (let lap = 0; lap <= (o.closed ? 1 : 0); lap++) {
      for (let j = 0; j < o.points.length; j++) {
        if (!o.closed && (j === 0 || j === o.points.length - 1)) continue; // an open polyline's ends are not corners
        const at = o.cum[j] + lap * o.length;
        if (at > s0 + 1e-6 && at < s1 - 1e-6) points.push(o.points[j]);
      }
    }
  }
  points.push(pointAt(o, s1));
  return points;
}

// ---- crossings ----
// Where two segments meet, as [t on ab, u on cd] pairs. Segments lying on one line (two shapes sharing a side, a side
// along the frame) meet wherever an end of one lies on the other: those ends become nodes, so the shared stretch is
// the same edge for both, and the walk below keeps just one copy of it.
function segmentSegment(a, b, c, d) {
  const rx = b[0] - a[0], ry = b[1] - a[1], sx = d[0] - c[0], sy = d[1] - c[1];
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9 * Math.hypot(rx, ry) * Math.hypot(sx, sy)) {
    const rr = rx * rx + ry * ry, ss = sx * sx + sy * sy;
    if (!rr || !ss || Math.abs((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / Math.sqrt(rr) > 1e-6) return []; // parallel, apart
    const along = (p, o, vx, vy, len) => ((p[0] - o[0]) * vx + (p[1] - o[1]) * vy) / len;
    const hits = [];
    for (const [p, u] of [[c, 0], [d, 1]]) { const t = along(p, a, rx, ry, rr); if (t > 1e-9 && t < 1 - 1e-9) hits.push([t, u]); }
    for (const [p, t] of [[a, 0], [b, 1]]) { const u = along(p, c, sx, sy, ss); if (u > -1e-9 && u < 1 + 1e-9) hits.push([t, Math.min(Math.max(u, 0), 1)]); }
    return hits;
  }
  const t = ((c[0] - a[0]) * sy - (c[1] - a[1]) * sx) / den, u = ((c[0] - a[0]) * ry - (c[1] - a[1]) * rx) / den;
  return t >= -1e-9 && t <= 1 + 1e-9 && u >= -1e-9 && u <= 1 + 1e-9 ? [[Math.min(Math.max(t, 0), 1), Math.min(Math.max(u, 0), 1)]] : [];
}

function segmentCircle(a, b, cx, cy, r) {
  const dx = b[0] - a[0], dy = b[1] - a[1], fx = a[0] - cx, fy = a[1] - cy;
  const A = dx * dx + dy * dy, B = 2 * (fx * dx + fy * dy), C = fx * fx + fy * fy - r * r;
  const disc = B * B - 4 * A * C;
  if (disc < 0 || A === 0) return [];
  const root = Math.sqrt(disc);
  return [(-B - root) / (2 * A), (-B + root) / (2 * A)].filter(t => t >= -1e-9 && t <= 1 + 1e-9).map(t => Math.min(Math.max(t, 0), 1));
}

function circleCircle(p, q) {
  const dx = q.cx - p.cx, dy = q.cy - p.cy, d = Math.hypot(dx, dy);
  if (d === 0 || d > p.r + q.r || d < Math.abs(p.r - q.r)) return [];
  const a = (p.r * p.r - q.r * q.r + d * d) / (2 * d), h = Math.sqrt(Math.max(0, p.r * p.r - a * a));
  const mx = p.cx + (a * dx) / d, my = p.cy + (a * dy) / d;
  return [[mx + (h * dy) / d, my - (h * dx) / d], [mx - (h * dy) / d, my + (h * dx) / d]];
}

// where a point on the arc's circle falls along the arc, or null when it is off the arc
function arcParam(o, [x, y]) {
  let d = Math.atan2(y - o.cy, x - o.cx) - o.a0;
  d = ((d % TAU) + TAU) % TAU;
  const span = o.a1 - o.a0;
  if (d > span + 1e-9) {
    if (TAU - d < 1e-9) d = 0; // a hair before a0
    else return null;
  }
  return Math.min(d, span) * o.r;
}

// a curve as simple parts: polyline segments (with where they start along it) or the arc itself
function partsOf(o) {
  if (o.kind === 'arc') return [{ arc: true }];
  return Array.from({ length: o.segs }, (_, i) => ({ i, a: o.points[i], b: o.points[(i + 1) % o.points.length], s: o.cum[i], len: o.cum[i + 1] - o.cum[i] }));
}

// every crossing of curves A and B (B === A for a curve crossing itself), as [s on A, s on B, point]
function crossings(A, B) {
  const found = [], self = A === B;
  const pa = partsOf(A), pb = partsOf(B);
  for (let x = 0; x < pa.length; x++) {
    for (let y = self ? x + 1 : 0; y < pb.length; y++) {
      const p = pa[x], q = pb[y];
      if (self) {
        if (p.arc) continue; // an arc never crosses itself
        if (q.i === p.i + 1 || (A.closed && p.i === 0 && q.i === A.segs - 1)) continue; // neighbours share a corner
      }
      if (p.arc && q.arc) {
        for (const pt of circleCircle(A, B)) {
          const sa = arcParam(A, pt), sb = arcParam(B, pt);
          if (sa !== null && sb !== null) found.push([sa, sb, pt]);
        }
      } else if (p.arc || q.arc) {
        const seg = p.arc ? q : p, arc = p.arc ? A : B;
        for (const t of segmentCircle(seg.a, seg.b, arc.cx, arc.cy, arc.r)) {
          const pt = [seg.a[0] + (seg.b[0] - seg.a[0]) * t, seg.a[1] + (seg.b[1] - seg.a[1]) * t];
          const sArc = arcParam(arc, pt);
          if (sArc === null) continue;
          const sSeg = seg.s + t * seg.len;
          found.push(p.arc ? [sArc, sSeg, pt] : [sSeg, sArc, pt]);
        }
      } else {
        for (const hit of segmentSegment(p.a, p.b, q.a, q.b)) found.push([p.s + hit[0] * p.len, q.s + hit[1] * q.len, [p.a[0] + (p.b[0] - p.a[0]) * hit[0], p.a[1] + (p.b[1] - p.a[1]) * hit[0]]]);
      }
    }
  }
  return found;
}

// ---- rings: area, centroid, inside tests, a point surely inside ----
const signedArea = ring => {
  let s = 0;
  for (let i = 0, n = ring.length; i < n; i++) s += ring[i][0] * ring[(i + 1) % n][1] - ring[(i + 1) % n][0] * ring[i][1];
  return s / 2;
};

function centroidOf(rings) {
  let area = 0, x = 0, y = 0;
  for (const ring of rings) {
    for (let i = 0, n = ring.length; i < n; i++) {
      const [x0, y0] = ring[i], [x1, y1] = ring[(i + 1) % n], cross = x0 * y1 - x1 * y0;
      area += cross;
      x += (x0 + x1) * cross;
      y += (y0 + y1) * cross;
    }
  }
  return area ? [x / (3 * area), y / (3 * area)] : rings[0][0];
}

export function insideRings(rings, x, y) {
  let inside = false;
  for (const ring of rings) {
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
      const [xi, yi] = ring[i], [xj, yj] = ring[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
  }
  return inside;
}

// the middle of the widest inside stretch along a few horizontal lines through the area
function interiorPoint(rings, box) {
  let best = null;
  for (const f of [0.5, 0.35, 0.65, 0.2, 0.8]) {
    const y = box.y0 + (box.y1 - box.y0) * f, xs = [];
    for (const ring of rings) {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i], [xj, yj] = ring[j];
        if (yi > y !== yj > y) xs.push(((xj - xi) * (y - yi)) / (yj - yi) + xi);
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const w = xs[k + 1] - xs[k];
      if (!best || w > best.w) best = { w, x: (xs[k] + xs[k + 1]) / 2, y };
    }
  }
  return best ? [best.x, best.y] : centroidOf(rings);
}

const boxOf = ring => ring.reduce((b, [x, y]) => ({ x0: Math.min(b.x0, x), y0: Math.min(b.y0, y), x1: Math.max(b.x1, x), y1: Math.max(b.y1, y) }), { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity });

// ---- the arrangement ----
export function arrangement(input) {
  const curves = input.map(prepare).filter(c => c.length > 0);

  // every crossing, and every loose end, as a node; and where each falls along its curves
  const nodes = [];
  const nodeAt = p => {
    let i = nodes.findIndex(q => Math.hypot(q[0] - p[0], q[1] - p[1]) < EPS);
    if (i < 0) { i = nodes.length; nodes.push(p); }
    return i;
  };
  const cuts = curves.map(() => []);
  for (let a = 0; a < curves.length; a++) {
    for (let b = a; b < curves.length; b++) {
      for (const [sa, sb, p] of crossings(curves[a], curves[b])) {
        const node = nodeAt(p);
        cuts[a].push({ s: sa, node });
        cuts[b].push({ s: sb, node });
      }
    }
    if (!curves[a].closed) {
      cuts[a].push({ s: 0, node: nodeAt(pointAt(curves[a], 0)) });
      cuts[a].push({ s: curves[a].length, node: nodeAt(pointAt(curves[a], curves[a].length)) });
    }
  }

  // each curve cut into pieces between consecutive cuts; a closed curve with no crossing stays a whole loop
  const pieces = [], loops = [];
  curves.forEach((o, k) => {
    const list = cuts[k].sort((p, q) => p.s - q.s).filter((c, i, all) => i === 0 || c.s - all[i - 1].s > 1e-6 || c.node !== all[i - 1].node);
    if (o.closed && list.length > 1 && list[list.length - 1].node === list[0].node && list[0].s + o.length - list[list.length - 1].s < 1e-6) list.pop();
    if (o.closed && !list.length) {
      loops.push({ curve: k, points: samplePiece(o, 0, o.length).slice(0, -1) });
      pieces.push({ curve: k, s0: 0, s1: o.length, points: samplePiece(o, 0, o.length), whole: true });
      return;
    }
    const count = o.closed ? list.length : list.length - 1;
    for (let i = 0; i < count; i++) {
      const c = list[i], next = list[(i + 1) % list.length];
      const s1 = o.closed && i + 1 === list.length ? next.s + o.length : next.s;
      if (s1 - c.s < 1e-6) continue;
      const points = samplePiece(o, c.s, s1);
      points[0] = nodes[c.node];
      points[points.length - 1] = nodes[next.node]; // pieces meet at exactly the node's point
      pieces.push({ curve: k, s0: c.s, s1, points, from: c.node, to: next.node, out: directionAt(o, c.s, false), back: directionAt(o, s1, true) + Math.PI });
    }
  });

  // a straight piece between the same two nodes as another is the same edge (a shared side): keep one copy
  const straight = new Set();
  const linked = pieces.filter(p => {
    if (p.whole) return false;
    if (p.points.length !== 2) return true;
    const key = p.from < p.to ? `${p.from}|${p.to}` : `${p.to}|${p.from}`;
    if (p.from === p.to || straight.has(key)) return false;
    straight.add(key);
    return true;
  });

  // peel off pieces with a loose end, repeatedly: a stub bounds nothing
  const degree = new Array(nodes.length).fill(0);
  for (const p of linked) { degree[p.from]++; degree[p.to]++; }
  let peeled = true;
  while (peeled) {
    peeled = false;
    for (const p of linked) {
      if (p.gone || (degree[p.from] > 1 && degree[p.to] > 1)) continue;
      p.gone = true;
      degree[p.from]--;
      degree[p.to]--;
      peeled = true;
    }
  }

  // the rest as half-edges in pairs: 2k forward, 2k + 1 the same piece backwards
  const halfEdges = [];
  for (const p of linked) {
    if (p.gone) continue;
    halfEdges.push({ from: p.from, to: p.to, points: p.points, angle: p.out });
    halfEdges.push({ from: p.to, to: p.from, points: [...p.points].reverse(), angle: p.back });
  }

  // at each node, the edges leaving it in order of their exact direction (normalised to one turn)
  const leaving = nodes.map(() => []);
  halfEdges.forEach((h, i) => {
    h.angle = Math.atan2(Math.sin(h.angle), Math.cos(h.angle));
    leaving[h.from].push(i);
  });
  for (const list of leaving) list.sort((p, q) => halfEdges[p].angle - halfEdges[q].angle);

  // walk: arriving at a node, leave by the edge just before the way back, in that order; each walk closes one ring
  const twin = i => i ^ 1;
  const seen = new Uint8Array(halfEdges.length);
  const rings = [];
  for (let start = 0; start < halfEdges.length; start++) {
    if (seen[start]) continue;
    const ring = [];
    let h = start, guard = 0;
    do {
      seen[h] = 1;
      ring.push(...halfEdges[h].points.slice(0, -1));
      const list = leaving[halfEdges[h].to], at = list.indexOf(twin(h));
      h = list[(at - 1 + list.length) % list.length];
    } while (h !== start && ++guard < 100000);
    rings.push(ring);
  }
  for (const loop of loops) rings.push(loop.points, [...loop.points].reverse()); // a lone loop: its inside, and its outside

  // Positive rings bound an area; negative ones are the outside edge of a group of touching curves, and become a
  // hole in the smallest area that contains them (or lie in the open background when none does).
  const faces = [], outsides = [];
  for (const ring of rings) {
    const area = signedArea(ring);
    if (Math.abs(area) < 4) continue; // slivers where curves only just touch
    if (area > 0) faces.push({ rings: [ring], outer: area, box: boxOf(ring) });
    else outsides.push(ring);
  }
  for (const ring of outsides) {
    const [x, y] = ring[0];
    let host = null;
    for (const f of faces) {
      if (x < f.box.x0 || x > f.box.x1 || y < f.box.y0 || y > f.box.y1) continue;
      if (insideRings([f.rings[0]], x, y) && !f.rings[0].includes(ring[0]) && (!host || f.outer < host.outer)) host = f;
    }
    if (host) host.rings.push(ring);
  }

  return {
    faces: faces.map(f => {
      const area = f.rings.reduce((sum, ring) => sum + signedArea(ring), 0);
      const [cx, cy] = centroidOf(f.rings);
      const [ix, iy] = interiorPoint(f.rings, f.box);
      return { rings: f.rings, area, cx, cy, ix, iy, box: f.box };
    }),
    pieces: pieces.map(({ curve, s0, s1, points }) => ({ curve, s0, s1, points }))
  };
}
