// ===================== math helpers =====================
const deg = Math.PI / 180;
const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const len = (a) => Math.hypot(a[0], a[1], a[2]);
const nrm = (a) => { const l = len(a) || 1; return [a[0] / l, a[1] / l, a[2] / l]; };
const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const fmix = (a, b, t) => a + (b - a) * t;

// ===================== body parameters =====================
// Coordinates are "normalized" (male-sized metres). World = normalized * P.s.
// +X = patient's LEFT, +Y = up, +Z = front (anterior).
function makeParams(sex) {
  const F = sex === 'female';
  const P = { sex, F, s: F ? 0.94 : 1 };
  P.headC = [0, 1.64, 0.008];
  P.headR = F ? [0.074, 0.1, 0.092] : [0.077, 0.104, 0.096];
  P.neckR = F ? [0.05, 0.045] : [0.058, 0.052];
  P.shX = F ? 0.172 : 0.193; P.shY = 1.395;
  P.chest = F ? [0.145, 0.15, 0.095] : [0.163, 0.16, 0.105];
  P.waist = F ? [0.118, 0.15, 0.088] : [0.142, 0.16, 0.098];
  P.pelvis = F ? [0.172, 0.115, 0.108] : [0.158, 0.112, 0.104];
  P.hipX = F ? 0.09 : 0.085;
  P.Lua = 0.29; P.Lfa = 0.25;
  P.ar = F ? 0.88 : 1; P.lr = F ? 1.02 : 1;
  const ang = 32 * deg;
  P.arm = [1, -1].map(sg => {
    const d = [sg * Math.cos(ang), -Math.sin(ang), 0];
    const u = [sg * Math.sin(ang), Math.cos(ang), 0]; // lateral (thumb side, palm forward)
    const S = [sg * P.shX, P.shY, 0];
    const E = add(S, mul(d, P.Lua));
    const W = add(E, mul(d, P.Lfa));
    const A = { sg, d, u, S, E, W };
    A.pt = (a, b, c) => [S[0] + d[0] * a + u[0] * b, S[1] + d[1] * a + u[1] * b, S[2] + c];
    A.hp = (a, b, c) => [W[0] + d[0] * a + u[0] * b, W[1] + d[1] * a + u[1] * b, W[2] + c];
    // fingers: index, middle, ring, little
    const ar = P.ar;
    const bases = [0.026, 0.009, -0.009, -0.025], angs = [10, 3, -4, -12], Ls = [0.074, 0.082, 0.077, 0.062], r0 = [0.0095, 0.0098, 0.0092, 0.0082];
    A.fingers = bases.map((b, i) => {
      const a = angs[i] * deg;
      const f = nrm(add(mul(d, Math.cos(a)), mul(u, Math.sin(a))));
      const B = A.hp(0.088 * ar, b * ar, 0.0);
      const L = Ls[i] * ar, segs = [0.46, 0.30, 0.24];
      const pts = [B]; let acc = B;
      segs.forEach(sf => { acc = add(acc, mul(f, L * sf)); pts.push(acc); });
      return { i, f, pts, r: r0[i] * ar, rt: 0.0072 * ar };
    });
    const tdir = nrm(add(add(mul(d, 0.45), mul(u, 0.85)), [0, 0, 0.25]));
    const T0 = A.hp(0.02 * ar, 0.024 * ar, 0.004), T1 = A.hp(0.05 * ar, 0.052 * ar, 0.012);
    const T2 = add(T1, mul(tdir, 0.032 * ar)), T3 = add(T2, mul(tdir, 0.026 * ar));
    A.thumb = [T0, T1, T2, T3];
    return A;
  });
  P.leg = [1, -1].map(sg => {
    const Hj = [sg * P.hipX, 0.92, 0], K = [sg * (P.hipX + 0.075), 0.505, 0.005], A = [sg * (P.hipX + 0.15), 0.09, -0.012];
    const L = { sg, Hj, K, A };
    // thigh / shin point helpers: t along segment, lat outward offset, ant forward offset
    L.th = (t, lat, ant) => { const b = lerp3(Hj, K, t); return [b[0] + sg * lat, b[1], b[2] + ant]; };
    L.sh = (t, lat, ant) => { const b = lerp3(K, A, t); return [b[0] + sg * lat, b[1], b[2] + ant]; };
    L.ft = (lat, y, z) => [A[0] + sg * lat, y, z]; // foot local: lat (+ = lateral), absolute y,z
    const offs = [-0.026, -0.002, 0.0145, 0.0295, 0.0425], lens = [0.042, 0.034, 0.03, 0.026, 0.022], rr = [0.0115, 0.0078, 0.0074, 0.007, 0.0065], ys = [0.014, 0.012, 0.011, 0.0105, 0.01];
    L.toes = offs.map((o, i) => {
      const z0 = 0.105 - i * 0.006, spread = (i - 1) * 3 * deg;
      const a = L.ft(o, ys[i] + 0.004, z0);
      const b = L.ft(o + Math.sin(spread) * lens[i], ys[i], z0 + Math.cos(spread) * lens[i]);
      return { i, a, b, r: rr[i] };
    });
    return L;
  });
  return P;
}

// ===================== primitives =====================
function smin(a, b, k) { if (k <= 0) return Math.min(a, b); const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; }

function mkEll(c, r, k, tag, op) { return { t: 0, cx: c[0], cy: c[1], cz: c[2], rx: r[0], ry: r[1], rz: r[2], k, tag, op: op || 'add', c, br: Math.max(r[0], r[1], r[2]) }; }
function mkOEll(c, e1, e2, e3, r, k, tag, op) { return { t: 1, c, e1, e2, e3, rx: r[0], ry: r[1], rz: r[2], k, tag, op: op || 'add', br: Math.max(r[0], r[1], r[2]) }; }
function mkRC(a, b, r1, r2, k, tag, op) { const ba = sub(b, a); return { t: 2, a, b, ba, bb: dot(ba, ba), r1, r2, k, tag, op: op || 'add', c: lerp3(a, b, 0.5), br: len(ba) / 2 + Math.max(r1, r2) }; }

function primDist(p, x, y, z) {
  if (p.t === 0) {
    const px = (x - p.cx) / p.rx, py = (y - p.cy) / p.ry, pz = (z - p.cz) / p.rz;
    const k0 = Math.sqrt(px * px + py * py + pz * pz);
    const qx = px / p.rx, qy = py / p.ry, qz = pz / p.rz;
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(p.rx, p.ry, p.rz);
  } else if (p.t === 1) {
    const dx = x - p.c[0], dy = y - p.c[1], dz = z - p.c[2];
    const lx = (dx * p.e1[0] + dy * p.e1[1] + dz * p.e1[2]) / p.rx;
    const ly = (dx * p.e2[0] + dy * p.e2[1] + dz * p.e2[2]) / p.ry;
    const lz = (dx * p.e3[0] + dy * p.e3[1] + dz * p.e3[2]) / p.rz;
    const k0 = Math.sqrt(lx * lx + ly * ly + lz * lz);
    const qx = lx / p.rx, qy = ly / p.ry, qz = lz / p.rz;
    const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
    return k1 > 1e-9 ? k0 * (k0 - 1) / k1 : -Math.min(p.rx, p.ry, p.rz);
  } else {
    const pax = x - p.a[0], pay = y - p.a[1], paz = z - p.a[2];
    let t = (pax * p.ba[0] + pay * p.ba[1] + paz * p.ba[2]) / p.bb; t = t < 0 ? 0 : t > 1 ? 1 : t;
    const dx = pax - p.ba[0] * t, dy = pay - p.ba[1] * t, dz = paz - p.ba[2] * t;
    return Math.sqrt(dx * dx + dy * dy + dz * dz) - (p.r1 + (p.r2 - p.r1) * t);
  }
}

function makeSDF(prims) {
  // spatial buckets: each 5 cm cell lists only primitives that can matter near it
  const CS = 0.05, HD = CS * 0.866, MARGIN = 0.1, buckets = new Map();
  const bucket = (x, y, z) => {
    const i = Math.floor(x / CS), j = Math.floor(y / CS), k = Math.floor(z / CS), key = ((i + 64) * 128 + (j + 64)) * 128 + (k + 64);
    let b = buckets.get(key);
    if (!b) {
      const cx = (i + 0.5) * CS, cy = (j + 0.5) * CS, cz = (k + 0.5) * CS;
      const near = p => Math.hypot(cx - p.c[0], cy - p.c[1], cz - p.c[2]) - p.br - p.k < HD + MARGIN;
      b = { adds: prims.filter(p => p.op === 'add' && near(p)), subs: prims.filter(p => p.op === 'sub' && near(p)) };
      buckets.set(key, b);
    }
    return b;
  };
  const f = function (x, y, z) {
    const bk = bucket(x, y, z), adds = bk.adds, subs = bk.subs;
    if (!adds.length) return Math.max(MARGIN, -y);
    let d = 1e9;
    for (let i = 0; i < adds.length; i++) {
      const p = adds[i];
      const lb = Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.br;
      if (lb - p.k > d) continue;
      d = smin(d, primDist(p, x, y, z), p.k);
    }
    for (let i = 0; i < subs.length; i++) {
      const p = subs[i];
      const lb = Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.br;
      if (lb - p.k > -d) continue;
      d = -smin(-d, primDist(p, x, y, z), p.k);
    }
    return Math.max(d, -y);
  };
  f.near = (x, y, z) => bucket(x, y, z).adds;
  return f;
}

function buildPrims(P) {
  const F = P.F, pr = [];
  const E = (c, r, k, tag, op) => pr.push(mkEll(c, r, k, tag, op));
  const RC = (a, b, r1, r2, k, tag, op) => pr.push(mkRC(a, b, r1, r2, k, tag, op));
  const OE = (c, e1, e2, e3, r, k, tag, op) => pr.push(mkOEll(c, e1, e2, e3, r, k, tag, op));
  // ---- torso
  E([0, 1.30, 0], P.chest, 0.05, { part: 'chest' });
  E([0, 1.12, 0.004], P.waist, 0.06, { part: 'abdomen' });
  E([0, 0.945, -0.004], P.pelvis, 0.06, { part: 'pelvis' });
  for (const sg of [1, -1]) {
    E([sg * (F ? 0.09 : 0.084), 0.875, -0.05], F ? [0.086, 0.092, 0.08] : [0.078, 0.088, 0.074], 0.028, { part: 'glute', sg });
    if (F) {
      E([sg * 0.082, 1.258, 0.075], [0.062, 0.058, 0.058], 0.014, { part: 'breast', sg });
      E([sg * 0.086, 1.255, 0.1325], [0.0065, 0.0065, 0.005], 0.004, { part: 'nipple', sg });
    } else {
      E([sg * 0.072, 1.315, 0.052], [0.078, 0.055, 0.05], 0.04, { part: 'chest' });
      E([sg * 0.082, 1.305, 0.1], [0.0045, 0.0045, 0.0035], 0.003, { part: 'nipple', sg });
    }
    RC([sg * 0.05, 1.425, -0.012], [sg * (P.shX - 0.01), 1.41, -0.005], 0.06 * (F ? 0.9 : 1), 0.052 * (F ? 0.9 : 1), 0.045, { part: 'shoulder' });
    RC([sg * 0.025, 1.50, -0.022], [sg * 0.14, 1.43, -0.02], 0.032, 0.035 * (F ? 0.9 : 1), 0.04, { part: 'trap' });
  }
  E([0, 1.045, 0.09], [0.006, 0.008, 0.008], 0.004, { part: 'navel' }, 'sub');
  // ---- neck & head
  RC([0, 1.44, -0.008], [0, 1.575, -0.004], P.neckR[0], P.neckR[1], 0.035, { part: 'neck' });
  E(P.headC, P.headR, 0.03, { part: 'head' });
  E([0, 1.582, 0.03], [0.058, 0.05, 0.065], 0.03, { part: 'jaw' });
  E([0, 1.552, 0.075], [0.022, 0.016, 0.018], 0.015, { part: 'chin' });
  E([0, 1.671, 0.086], [0.046, 0.0095, 0.012], 0.018, { part: 'brow' });
  RC([0, 1.66, 0.098], [0, 1.617, 0.116], 0.007, 0.0105, 0.012, { part: 'nose' });
  E([0, 1.612, 0.116], [0.012, 0.01, 0.01], 0.008, { part: 'nose' });
  E([0, 1.583, 0.099], [0.022, 0.006, 0.009], 0.006, { part: 'lips' });
  E([0, 1.573, 0.097], [0.02, 0.0065, 0.009], 0.006, { part: 'lips' });
  for (const sg of [1, -1]) {
    E([sg * 0.045, 1.628, 0.075], [0.022, 0.014, 0.018], 0.015, { part: 'cheek', sg });
    E([sg * 0.011, 1.612, 0.106], [0.007, 0.007, 0.007], 0.006, { part: 'nose' });
    E([sg * 0.032, 1.648, 0.1], [0.019, 0.0125, 0.016], 0.008, { part: 'eye', sg }, 'sub');
    E([sg * 0.032, 1.647, 0.079], [0.0125, 0.0115, 0.0125], 0.002, { part: 'eye', sg });
    E([sg * 0.079, 1.632, -0.005], [0.009, 0.03, 0.019], 0.006, { part: 'ear', sg });
    E([sg * 0.088, 1.628, 0.0], [0.005, 0.007, 0.005], 0.003, { part: 'ear', sg }, 'sub');
  }
  // ---- arms & hands
  for (const A of P.arm) {
    const sg = A.sg, ar = P.ar;
    E(add(A.S, mul(A.d, 0.01)), [0.058 * ar, 0.062 * ar, 0.058 * ar], 0.03, { part: 'deltoid', sg });
    RC(A.S, A.E, 0.047 * ar, 0.037 * ar, 0.035, { part: 'upperarm', sg });
    RC(A.E, A.W, 0.041 * ar, 0.026 * ar, 0.025, { part: 'forearm', sg });
    OE(add(A.E, mul(A.d, 0.07)), A.d, A.u, [0, 0, 1], [0.08, 0.036 * ar, 0.032 * ar], 0.03, { part: 'forearm', sg });
    OE(A.hp(0.048 * ar, 0, 0), A.d, A.u, [0, 0, 1], [0.05 * ar, 0.043 * ar, 0.0135 * ar], 0.015, { part: 'palm', sg });
    OE(A.hp(0.035 * ar, 0.022 * ar, 0.006), A.d, A.u, [0, 0, 1], [0.025 * ar, 0.016 * ar, 0.012 * ar], 0.01, { part: 'thenar', sg });
    A.fingers.forEach(f => {
      for (let s = 0; s < 3; s++) {
        const r1 = fmix(f.r, f.rt, s / 3), r2 = fmix(f.r, f.rt, (s + 1) / 3);
        RC(f.pts[s], f.pts[s + 1], r1, r2, 0.004, { part: 'finger', sg, i: f.i, seg: s, a: f.pts[s], b: f.pts[s + 1] });
      }
    });
    const T = A.thumb, tr = [0.0125, 0.0105, 0.0095, 0.008].map(v => v * ar);
    for (let s = 0; s < 3; s++) RC(T[s], T[s + 1], tr[s], tr[s + 1], s === 0 ? 0.012 : 0.004, { part: 'thumb', sg, seg: s, a: T[s], b: T[s + 1] });
  }
  // ---- legs & feet
  for (const L of P.leg) {
    const sg = L.sg, lr = P.lr, A = L.A;
    RC(L.Hj, L.K, 0.088 * lr, 0.056 * lr, 0.05, { part: 'thigh', sg });
    E(add(lerp3(L.Hj, L.K, 0.5), [0, 0, 0.018]), [0.068 * lr, 0.15, 0.06 * lr], 0.04, { part: 'thigh', sg });
    E(add(L.K, [0, 0.005, 0.045]), [0.022, 0.026, 0.012], 0.02, { part: 'knee', sg });
    RC(L.K, A, 0.051 * lr, 0.032 * lr, 0.03, { part: 'shin', sg });
    E(add(lerp3(L.K, A, 0.33), [0, 0, -0.032]), [0.05 * lr, 0.10, 0.048 * lr], 0.035, { part: 'calf', sg });
    E(add(A, [-sg * 0.022, -0.012, -0.004]), [0.011, 0.011, 0.011], 0.01, { part: 'ankle', sg, med: true });
    E(add(A, [sg * 0.024, -0.02, -0.008]), [0.011, 0.011, 0.011], 0.01, { part: 'ankle', sg, med: false });
    E(L.ft(0, 0.033, -0.047), [0.028, 0.033, 0.032], 0.02, { part: 'heel', sg });
    E(L.ft(0.004, 0.03, 0.035), [0.04, 0.028, 0.08], 0.025, { part: 'foot', sg });
    E(L.ft(0, 0.055, 0.0), [0.032, 0.03, 0.05], 0.03, { part: 'foot', sg });
    E(L.ft(-0.03, 0.0, 0.03), [0.02, 0.016, 0.045], 0.01, { part: 'foot', sg }, 'sub');
    L.toes.forEach(t => RC(t.a, t.b, t.r, t.r * 0.85, 0.004, { part: 'toe', sg, i: t.i, a: t.a, b: t.b }));
  }
  return pr;
}

// bisection helpers to find surface points of the base body
function surfDown(sdf, x, z, y0, y1) { // first surface going downward from y0 (outside) to y1 (inside)
  let a = y0, b = y1; if (sdf(x, a, z) < 0) return a;
  for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (sdf(x, m, z) > 0) a = m; else b = m; }
  return (a + b) / 2;
}
function surfZ(sdf, x, y, z0, z1) { let a = z0, b = z1; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (sdf(x, y, m) > 0) a = m; else b = m; } return (a + b) / 2; }

function addGenitals(P, prims) {
  const base = makeSDF(prims);
  // perineal floor points along midline
  const floor = z => surfDown(base, 0, z, 0.8, 0.93);
  // floor search must start below body: from y=0.78 going up we're outside; use upward search
  const floorUp = z => { let a = 0.76, b = 0.93; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (base(0, m, z) > 0) a = m; else b = m; } return (a + b) / 2; };
  const E = (c, r, k, tag, op) => prims.push(mkEll(c, r, k, tag, op));
  const RC = (a, b, r1, r2, k, tag, op) => prims.push(mkRC(a, b, r1, r2, k, tag, op));
  const za = -0.04; const Pa = [0, floorUp(za), za];
  P.anus = Pa;
  E(add(Pa, [0, -0.001, 0]), [0.0055, 0.006, 0.0055], 0.003, { part: 'anus' }, 'sub');
  const frontZ = surfZ(base, 0, 0.885, 0.2, 0.0);
  if (!P.F) {
    E([0, 0.893, frontZ - 0.02], [0.05, 0.03, 0.025], 0.03, { part: 'mons' });
    const root = [0, 0.885, frontZ - 0.006];
    const dir = nrm([0, -0.45, 0.89]);
    const end = add(root, mul(dir, 0.08));
    RC(root, end, 0.0145, 0.013, 0.01, { part: 'penis', a: root, b: end });
    const gc = add(end, mul(dir, 0.012));
    const e2 = nrm(cross(dir, [1, 0, 0]));
    prims.push(mkOEll(gc, [1, 0, 0], e2, dir, [0.0155, 0.0155, 0.02], 0.004, { part: 'glans', a: end, b: add(gc, mul(dir, 0.02)) }));
    P.penis = { root, end, tip: add(gc, mul(dir, 0.02)), dir };
    P.testes = [];
    for (const sg of [1, -1]) {
      const tc = [sg * 0.027, root[1] - 0.052, root[2] + 0.024];
      RC([sg * 0.01, root[1] - 0.012, root[2] - 0.004], tc, 0.008, 0.009, 0.008, { part: 'scrotum', sg });
      E(tc, [0.017, 0.023, 0.019], 0.006, { part: 'testis', sg });
      P.testes.push(tc);
    }
    P.perinealFront = [0, floorUp(0.02), 0.02];
  } else {
    E([0, 0.893, frontZ - 0.018], [0.05, 0.032, 0.028], 0.03, { part: 'mons' });
    const Pf = [0, floorUp(0.06), 0.06], Pb = [0, floorUp(0.012), 0.012];
    for (const sg of [1, -1]) {
      RC(add(Pf, [sg * 0.013, 0.003, -0.002]), add(Pb, [sg * 0.012, 0.003, 0]), 0.0095, 0.008, 0.006, { part: 'labia_maj', sg });
      RC(add(Pf, [sg * 0.0045, 0.0005, -0.006]), add(Pb, [sg * 0.004, 0.0005, 0.004]), 0.0035, 0.003, 0.002, { part: 'labia_min', sg });
    }
    E(add(Pf, [0, -0.002, 0.006]), [0.006, 0.006, 0.008], 0.004, { part: 'clitoris' });
    const Pv = lerp3(Pf, Pb, 0.62);
    E(add(Pv, [0, 0.002, 0]), [0.004, 0.008, 0.009], 0.003, { part: 'vagina' }, 'sub');
    P.vulva = { Pf, Pb, Pv, Pu: lerp3(Pf, Pb, 0.32) };
    P.perinealFront = Pb;
  }
}

// ===================== surface nets =====================
function sampleGrid(sdf, x0, y0, z0, nx, ny, nz, h) {
  const N = nx * ny * nz, vals = new Float32Array(N);
  // coarse pass
  const C = 4, cnx = Math.ceil(nx / C) + 1, cny = Math.ceil(ny / C) + 1, cnz = Math.ceil(nz / C) + 1;
  const cv = new Float32Array(cnx * cny * cnz);
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++)
    cv[i + cnx * (j + cny * k)] = sdf(x0 + i * C * h, y0 + j * C * h, z0 + k * C * h);
  const band = C * h * 1.9;
  for (let k = 0; k < nz; k++) {
    const ck = Math.round(k / C);
    for (let j = 0; j < ny; j++) {
      const cj = Math.round(j / C);
      for (let i = 0; i < nx; i++) {
        const c = cv[Math.round(i / C) + cnx * (cj + cny * ck)];
        vals[i + nx * (j + ny * k)] = Math.abs(c) > band ? c : sdf(x0 + i * h, y0 + j * h, z0 + k * h);
      }
    }
  }
  return vals;
}

const CORN = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
const EDG = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];

// emitCell(x,y,z) -> bool decides whether faces around a cell are produced (for multi-grid stitching)
function surfaceNets(vals, nx, ny, nz, x0, y0, z0, h, emit, out) {
  const cnx = nx - 1, cny = ny - 1, cnz = nz - 1;
  const cellIdx = new Int32Array(cnx * cny * cnz).fill(-1);
  const cv = new Float32Array(8);
  const at = (i, j, k) => vals[i + nx * (j + ny * k)];
  const verts = out.pos, base = verts.length / 3;
  for (let k = 0; k < cnz; k++) for (let j = 0; j < cny; j++) for (let i = 0; i < cnx; i++) {
    let mask = 0;
    for (let c = 0; c < 8; c++) { const o = CORN[c]; const v = at(i + o[0], j + o[1], k + o[2]); cv[c] = v; if (v < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, cnt = 0;
    for (let e = 0; e < 12; e++) {
      const a = EDG[e][0], b = EDG[e][1];
      if (((mask >> a) & 1) !== ((mask >> b) & 1)) {
        const t = cv[a] / (cv[a] - cv[b]); const oa = CORN[a], ob = CORN[b];
        sx += oa[0] + (ob[0] - oa[0]) * t; sy += oa[1] + (ob[1] - oa[1]) * t; sz += oa[2] + (ob[2] - oa[2]) * t; cnt++;
      }
    }
    cellIdx[i + cnx * (j + cny * k)] = verts.length / 3;
    verts.push(x0 + (i + sx / cnt) * h, y0 + (j + sy / cnt) * h, z0 + (k + sz / cnt) * h);
  }
  const ci = (i, j, k) => cellIdx[i + cnx * (j + cny * k)];
  const quads = out.quads;
  const quad = (a, b, c, d, cx, cy, cz) => {
    if (a < 0 || b < 0 || c < 0 || d < 0) return;
    if (!emit(cx, cy, cz)) return;
    quads.push(a, b, c, d);
  };
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    const v0 = at(i, j, k) < 0;
    const px = x0 + i * h, py = y0 + j * h, pz = z0 + k * h;
    if (j > 0 && k > 0 && (at(i + 1, j, k) < 0) !== v0) quad(ci(i, j - 1, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i, j - 1, k), px + h / 2, py, pz);
    if (i > 0 && k > 0 && (at(i, j + 1, k) < 0) !== v0) quad(ci(i - 1, j, k - 1), ci(i, j, k - 1), ci(i, j, k), ci(i - 1, j, k), px, py + h / 2, pz);
    if (i > 0 && j > 0 && (at(i, j, k + 1) < 0) !== v0) quad(ci(i - 1, j - 1, k), ci(i, j - 1, k), ci(i, j, k), ci(i - 1, j, k), px, py, pz + h / 2);
  }
  return base;
}

function inBox(b, x, y, z, pad) { return x > b[0] - pad && x < b[3] + pad && y > b[1] - pad && y < b[4] + pad && z > b[2] - pad && z < b[5] + pad; }

function buildBodyMesh(sex, onProgress) {
  const P = makeParams(sex);
  const prims = buildPrims(P);
  addGenitals(P, prims);
  const sdf = makeSDF(prims);
  P.sdf = sdf;
  const hB = 0.008;
  const boxes = [];
  boxes.push({ b: [-0.11, 1.525, -0.115, 0.11, 1.77, 0.14], h: 0.0034 }); // head
  for (const A of P.arm) {
    const pts = [A.hp(-0.015, 0, 0), A.thumb[3], ...A.fingers.map(f => f.pts[3]), A.hp(0.05, -0.05, 0), A.hp(0.05, 0.06, 0)];
    const b = [1e9, 1e9, -0.035, -1e9, -1e9, 0.04];
    pts.forEach(p => { b[0] = Math.min(b[0], p[0] - 0.018); b[1] = Math.min(b[1], p[1] - 0.018); b[3] = Math.max(b[3], p[0] + 0.018); b[4] = Math.max(b[4], p[1] + 0.018); });
    boxes.push({ b, h: 0.0027 });
  }
  for (const L of P.leg) boxes.push({ b: [L.A[0] - 0.075, -0.004, -0.095, L.A[0] + 0.075, 0.125, 0.185], h: 0.004 });
  boxes.push({ b: [-0.072, 0.775, -0.14, 0.072, 0.93, 0.20], h: 0.0034 }); // pelvic floor & genitals
  if (P.F) boxes.push({ b: [-0.165, 1.17, 0.02, 0.165, 1.36, 0.2], h: 0.0055 }); // breasts
  const out = { pos: [], quads: [] };
  // main grid
  {
    const x0 = -0.95, y0 = -0.012, z0 = -0.19, nx = Math.ceil(1.9 / hB) + 1, ny = Math.ceil(1.79 / hB) + 1, nz = Math.ceil(0.42 / hB) + 1;
    const vals = sampleGrid(sdf, x0, y0, z0, nx, ny, nz, hB);
    surfaceNets(vals, nx, ny, nz, x0, y0, z0, hB, (x, y, z) => !boxes.some(B => inBox(B.b, x, y, z, -hB * 1.0)), out);
  }
  onProgress && onProgress(0.5);
  for (const B of boxes) {
    const h = B.h, pad = hB * 1.2;
    const x0 = B.b[0] - pad - h, y0 = Math.max(-0.012, B.b[1] - pad - h), z0 = B.b[2] - pad - h;
    const nx = Math.ceil((B.b[3] + pad + h - x0) / h) + 1, ny = Math.ceil((B.b[4] + pad + h - y0) / h) + 1, nz = Math.ceil((B.b[5] + pad + h - z0) / h) + 1;
    const vals = sampleGrid(sdf, x0, y0, z0, nx, ny, nz, h);
    surfaceNets(vals, nx, ny, nz, x0, y0, z0, h, (x, y, z) => inBox(B.b, x, y, z, 0), out);
  }
  onProgress && onProgress(0.8);
  // keep only referenced vertices
  const used = new Int32Array(out.pos.length / 3).fill(-1);
  let n = 0; for (const q of out.quads) if (used[q] < 0) used[q] = n++;
  const pos = new Float32Array(n * 3), nor = new Float32Array(n * 3), npos = new Float32Array(n * 3);
  const e = 0.0012;
  for (let old = 0; old < used.length; old++) {
    const v = used[old]; if (v < 0) continue;
    let x = out.pos[old * 3], y = out.pos[old * 3 + 1], z = out.pos[old * 3 + 2];
    // tetrahedral gradient (4 evaluations) gives both the distance and the normal
    const a = sdf(x + e, y - e, z - e), b = sdf(x - e, y - e, z + e), c = sdf(x - e, y + e, z - e), dd = sdf(x + e, y + e, z + e);
    let gx = a - b - c + dd, gy = -a - b + c + dd, gz = -a + b - c + dd;
    const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
    const d = (a + b + c + dd) * 0.25;
    if (Math.abs(d) < 0.006) { x -= gx * d; y -= gy * d; z -= gz * d; }
    nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
    if (y < 0.0) y = 0.0;
    npos[v * 3] = x; npos[v * 3 + 1] = y; npos[v * 3 + 2] = z;
    pos[v * 3] = x * P.s; pos[v * 3 + 1] = y * P.s; pos[v * 3 + 2] = z * P.s;
  }
  const idx = new Uint32Array(out.quads.length / 4 * 6);
  let t = 0;
  const tri = (a, b, c) => {
    const ax = npos[a * 3], ay = npos[a * 3 + 1], az = npos[a * 3 + 2];
    const ux = npos[b * 3] - ax, uy = npos[b * 3 + 1] - ay, uz = npos[b * 3 + 2] - az;
    const vx = npos[c * 3] - ax, vy = npos[c * 3 + 1] - ay, vz = npos[c * 3 + 2] - az;
    const cx = uy * vz - uz * vy, cy = uz * vx - ux * vz, cz = ux * vy - uy * vx;
    const sn = (nor[a * 3] + nor[b * 3] + nor[c * 3]) * cx + (nor[a * 3 + 1] + nor[b * 3 + 1] + nor[c * 3 + 1]) * cy + (nor[a * 3 + 2] + nor[b * 3 + 2] + nor[c * 3 + 2]) * cz;
    if (sn >= 0) { idx[t++] = a; idx[t++] = b; idx[t++] = c; } else { idx[t++] = a; idx[t++] = c; idx[t++] = b; }
  };
  for (let q = 0; q < out.quads.length; q += 4) {
    const a = used[out.quads[q]], b = used[out.quads[q + 1]], c = used[out.quads[q + 2]], d = used[out.quads[q + 3]];
    tri(a, b, c); tri(a, c, d);
  }
  // nearest primitive tag per vertex
  const addPr = prims.filter(p => p.op === 'add');
  const primIndex = new Map(addPr.map((p, i) => [p, i]));
  const tagIdx = new Int16Array(n), tagDist = new Float32Array(n);
  for (let v = 0; v < n; v++) {
    const x = npos[v * 3], y = npos[v * 3 + 1], z = npos[v * 3 + 2];
    let best = 1e9, bi = 0;
    const cand = sdf.near(x, y, z);
    for (let ci = 0; ci < cand.length; ci++) {
      const p = cand[ci], i = primIndex.get(p);
      const lb = Math.hypot(x - p.c[0], y - p.c[1], z - p.c[2]) - p.br; if (lb > best) continue;
      const d = primDist(p, x, y, z); if (d < best) { best = d; bi = i; }
    }
    tagIdx[v] = bi; tagDist[v] = best;
  }
  // vertex areas
  const varea = new Float32Array(n);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    const u = [pos[b * 3] - pos[a * 3], pos[b * 3 + 1] - pos[a * 3 + 1], pos[b * 3 + 2] - pos[a * 3 + 2]];
    const w = [pos[c * 3] - pos[a * 3], pos[c * 3 + 1] - pos[a * 3 + 1], pos[c * 3 + 2] - pos[a * 3 + 2]];
    const ar = len(cross(u, w)) / 6; varea[a] += ar; varea[b] += ar; varea[c] += ar;
  }
  onProgress && onProgress(1);
  return { P, prims, addPr, sdf, n, pos, npos, nor, idx, tagIdx, tagDist, varea };
}
