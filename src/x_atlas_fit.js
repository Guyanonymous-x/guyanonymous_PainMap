// ===================== BodyParts3D atlas: re-pose and fit into the app body (build-time, Node) =====================
// Input: atlas/cache (atlas_prepare.mjs) in app axes (metres, Y up, +Z front, +X patient's left), anatomical position.
// Output per sex: atlas meshes in the app's normalized body space, posed like the app (relaxed T-pose, legs apart)
// and radially fitted so that the atlas skin coincides with the app's skin.
function loadAtlasCache(fs, dir) {
  const parts = JSON.parse(fs.readFileSync(dir + '/atlas.json', 'utf8'));
  const buf = fs.readFileSync(dir + '/atlas.bin'); const ab = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
  let off = 0;
  for (const p of parts) { p.pos = new Float32Array(ab, off, p.nv * 3); off += p.nv * 12; p.idx = new Uint32Array(ab, off, p.ni); off += p.ni * 4; p.lname = p.name.toLowerCase(); p.side = /\bleft\b/.test(p.lname) ? 1 : /\bright\b/.test(p.lname) ? -1 : 0; }
  return parts;
}
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
function partBy(parts, rx) { return parts.find(p => rx.test(p.lname)); }
function verts(p) { const o = []; for (let i = 0; i < p.nv; i++) o.push([p.pos[i * 3], p.pos[i * 3 + 1], p.pos[i * 3 + 2]]); return o; }
function meanOf(vs) { const m = [0, 0, 0]; vs.forEach(v => { m[0] += v[0]; m[1] += v[1]; m[2] += v[2]; }); return mul(m, 1 / Math.max(1, vs.length)); }
function extremeMean(vs, key, frac, top) { const s = [...vs].sort((a, b) => key(a) - key(b)); const k = Math.max(3, Math.floor(s.length * frac)); return meanOf(top ? s.slice(-k) : s.slice(0, k)); }

// ---- landmarks of the atlas (anatomical position) ----
function atlasLandmarks(parts) {
  const L = { arm: {}, leg: {} };
  for (const sg of [1, -1]) {
    const sd = sg > 0 ? 'left' : 'right';
    const hum = verts(partBy(parts, new RegExp('^' + sd + ' humerus$'))), rad = verts(partBy(parts, new RegExp('^' + sd + ' radius$'))), uln = verts(partBy(parts, new RegExp('^' + sd + ' ulna$')));
    const S = add(extremeMean(hum, v => v[1], 0.05, true), [0, -0.014, 0]);
    const E = add(extremeMean(hum, v => v[1], 0.04, false), [0, 0.006, 0]);
    const W = add(meanOf([extremeMean(rad, v => v[1], 0.04, false), extremeMean(uln, v => v[1], 0.04, false)]), [0, 0.008, 0]);
    const fingers = ['index', 'middle', 'ring', 'little'].map(f => {
      const prox = verts(partBy(parts, new RegExp('^proximal phalanx of ' + sd + ' ' + f + ' finger$'))), dist = verts(partBy(parts, new RegExp('^distal phalanx of ' + sd + ' ' + f + ' finger$')));
      return { base: extremeMean(prox, v => v[1], 0.1, true), tip: extremeMean(dist, v => v[1], 0.03, false) };
    });
    const tp = verts(partBy(parts, new RegExp('^proximal phalanx of ' + sd + ' thumb$'))), td = verts(partBy(parts, new RegExp('^distal phalanx of ' + sd + ' thumb$'))), tm = verts(partBy(parts, new RegExp('^' + sd + ' first metacarpal bone$')));
    const thumb = { cmc: extremeMean(tm, v => v[1], 0.1, true), base: extremeMean(tp, v => v[1], 0.1, true), tip: extremeMean(td, v => v[1], 0.05, false) };
    L.arm[sg] = { S, E, W, fingers, thumb, tip: fingers[1].tip };
    const fem = verts(partBy(parts, new RegExp('^' + sd + ' femur$')));
    const topF = [...fem].sort((a, b) => b[1] - a[1]).slice(0, Math.floor(fem.length * 0.08));
    const H = add(extremeMean(topF, v => sg * v[0], 0.5, false), [0, -0.016, 0]); // medial half of the top = femoral head
    const K = add(extremeMean(fem, v => v[1], 0.04, false), [0, 0.012, 0]);
    const A = meanOf(verts(partBy(parts, new RegExp('^' + sd + ' talus$'))));
    const toes = ['big toe', 'second toe', 'third toe', 'fourth toe', 'little toe'].map(t => {
      const prox = verts(partBy(parts, new RegExp('^proximal phalanx of ' + sd + ' ' + t + '$'))), dist = verts(partBy(parts, new RegExp('^distal phalanx of ' + sd + ' ' + t + '$')));
      return { base: extremeMean(prox, v => v[2], 0.1, false), tip: extremeMean(dist, v => v[2], 0.03, true) };
    });
    L.leg[sg] = { H, K, A, toes };
  }
  const skin = verts(partBy(parts, /^skin$/));
  L.headTop = Math.max(...skin.map(v => v[1]));
  L.chin = Math.min(...verts(partBy(parts, /^mandible$/)).map(v => v[1]));
  L.eye = (meanOf(verts(partBy(parts, /^left lens$/)))[1] + meanOf(verts(partBy(parts, /^right lens$/)))[1]) / 2;
  L.skin = skin;
  return L;
}
// ---- app landmarks (normalized space) ----
function appLandmarks(P) {
  const L = { arm: {}, leg: {} };
  for (const A of P.arm) L.arm[A.sg] = { S: A.S, E: A.E, W: A.W, fingers: A.fingers.map(f => ({ base: f.pts[0], tip: f.pts[3] })), thumb: { cmc: A.thumb[0], base: A.thumb[1], tip: A.thumb[3] }, tip: A.fingers[1].pts[3] };
  for (const G of P.leg) L.leg[G.sg] = { H: G.Hj, K: G.K, A: G.A, toes: G.toes.map(t => ({ base: t.a, tip: t.b })) };
  L.headTop = P.headC[1] + P.headR[1];
  L.chin = 1.536; L.eye = 1.647; // procedural chin underside and eyeball centre (see buildPrims)
  return L;
}
// frame-to-frame map: atlas segment (a0->a1) to app segment (b0->b1), keeping a reference direction ("ref") aligned.
function segMap(a0, a1, b0, b1, ref, uniform) {
  const ua = nrm(sub(a1, a0)), ub = nrm(sub(b1, b0));
  const fa0 = nrm(sub(ref, mul(ua, dot(ref, ua)))), fb0 = nrm(sub(ref, mul(ub, dot(ref, ub))));
  const sa = cross(ua, fa0), sb = cross(ub, fb0);
  const k = len(sub(b1, b0)) / len(sub(a1, a0));
  const r = uniform ? k : 1;
  return {
    a0, b0, ua, ub, fa: fa0, fb: fb0, sa, sb, k, La: len(sub(a1, a0)), Lb: len(sub(b1, b0)),
    map(p) { const d = sub(p, a0); const a = dot(d, ua), f = dot(d, fa0), s = dot(d, sa); return add(b0, add(mul(ub, a * k), add(mul(fb0, f * r), mul(sb, s * r)))); },
    param(p) { return dot(sub(p, a0), ua) / this.La; },
  };
}
const ARM_IDS = new Set(['humerus', 'radius', 'ulna', 'carpals', 'metacarpals', 'phalanges_h', 'biceps', 'triceps', 'brachialis', 'brachioradialis', 'anconeus', 'coracobrachialis', 'wrist_flex', 'wrist_ext', 'fcu', 'pronator_teres', 'pronator_quadratus', 'supinator', 'thumb_abd', 'thenar', 'hypothenar', 'hand_intrinsics', 'flexor_retinac']);
const SHOULDER_IDS = new Set(['deltoid_ant', 'deltoid_mid', 'deltoid_post', 'supraspinatus', 'infraspinatus', 'teres_minor', 'teres_major', 'subscapularis', 'pec_major']);
const LEG_IDS = new Set(['femur', 'patella', 'tibia', 'fibula', 'talus', 'calcaneus', 'tarsals', 'metatarsals', 'phalanges_f', 'rectus_fem', 'vastus_lat', 'vastus_med', 'vastus_int', 'biceps_fem', 'semi_tend_memb', 'gastrocnemius', 'soleus', 'plantaris', 'popliteus', 'tib_ant', 'tib_post', 'peroneals', 'ext_dig_l', 'flex_dig_l', 'ext_dig_brevis', 'foot_intrinsics', 'itb', 'achilles', 'spring_lig', 'adductors', 'gracilis', 'sartorius', 'tfl', 'pectineus', 'glute_max', 'glute_med', 'glute_min', 'deep_rotators']);
const HIP_IDS = new Set(['adductors', 'gracilis', 'sartorius', 'tfl', 'pectineus', 'glute_max', 'glute_med', 'glute_min', 'deep_rotators', 'rectus_fem', 'biceps_fem', 'semi_tend_memb', 'iliopsoas']);
const ARM_VESSEL = /brachial|radial|ulnar|cephalic|basilic|axillary/, LEG_VESSEL = /femoral|popliteal|tibial|saphenous/;
function regionOf(p) {
  if (p.id === 'interosseous_mem') return /forearm/.test(p.lname) ? 'arm' : 'leg';
  if (p.layer === 'vessel') return ARM_VESSEL.test(p.lname) ? 'armblend' : LEG_VESSEL.test(p.lname) ? 'legblend' : 'torso';
  if (ARM_IDS.has(p.id)) return 'arm';
  if (SHOULDER_IDS.has(p.id)) return 'shoulder';
  if (HIP_IDS.has(p.id) || p.id === 'iliopsoas') return 'hip';
  if (LEG_IDS.has(p.id)) return 'leg';
  if (p.layer === 'skin') return 'skin';
  return 'torso';
}

function fitAtlas(parts, P, sdfFit, sdfFull) {
  const LA = parts.landmarks || (parts.landmarks = atlasLandmarks(parts)), LB = appLandmarks(P);
  const FRONT = [0, 0, 1], UP = [0, 1, 0];
  // ---- torso map: vertical piecewise-linear by hip, shoulder and head top; x scaled by width ratios ----
  const aH = (LA.leg[1].H[1] + LA.leg[-1].H[1]) / 2, bH = (LB.leg[1].H[1] + LB.leg[-1].H[1]) / 2;
  const aS = (LA.arm[1].S[1] + LA.arm[-1].S[1]) / 2, bS = (LB.arm[1].S[1] + LB.arm[-1].S[1]) / 2;
  const aT = LA.headTop, bT = LB.headTop;
  // control heights: hip joint, shoulder joint, chin, eyes, head top (piecewise linear between them)
  const CA = [0, aH, aS, LA.chin, LA.eye, aT], CB = [0, bH, bS, LB.chin, LB.eye, bT];
  const fY = y => { let i = 1; while (i < CA.length - 1 && y > CA[i]) i++; const a0 = CA[i - 1], a1 = CA[i], b0 = CB[i - 1], b1 = CB[i]; return b0 + (y - a0) * (b1 - b0) / (a1 - a0); };
  const hipX = (LB.leg[1].H[0] - LB.leg[-1].H[0]) / (LA.leg[1].H[0] - LA.leg[-1].H[0]), shX = (LB.arm[1].S[0] - LB.arm[-1].S[0]) / (LA.arm[1].S[0] - LA.arm[-1].S[0]);
  const sxY = y => y < aH ? hipX : y < aS ? fmix(hipX, shX, (y - aH) / (aS - aH)) : fmix(shX, P.headR[0] / 0.078, ss(aS, aS + 0.12, y));
  // AP alignment: match atlas skin mid-line (x≈0) front/back centre to the app body's, per height
  const NB = 60, zA = new Float32Array(NB), zB = new Float32Array(NB);
  { const lo = [], hi = []; for (let i = 0; i < NB; i++) { lo[i] = 1e9; hi[i] = -1e9; }
    for (const v of LA.skin) { if (Math.abs(v[0]) > 0.02) continue; const i = Math.floor(v[1] / aT * NB); if (i < 0 || i >= NB) continue; lo[i] = Math.min(lo[i], v[2]); hi[i] = Math.max(hi[i], v[2]); }
    for (let i = 0; i < NB; i++) {
      zA[i] = hi[i] > lo[i] ? (lo[i] + hi[i]) / 2 : NaN;
      const y = fY((i + 0.5) / NB * aT); let f = surfZ(sdfFit, 0, y, 0.3, -0.02), b = surfZ(sdfFit, 0, y, -0.3, 0.02);
      zB[i] = sdfFit(0, y, 0) < 0 ? (f + b) / 2 : NaN;
    }
    for (const arr of [zA, zB]) { let last = 0; for (let i = 0; i < NB; i++) if (isNaN(arr[i])) arr[i] = last; else last = arr[i]; }
  }
  const dzY = y => { const i = clamp(Math.floor(y / aT * NB), 0, NB - 1); return zB[i] - zA[i]; };
  const torsoMap = p => [p[0] * sxY(p[1]), fY(p[1]), p[2] + dzY(p[1])];
  // ---- limb maps ----
  const M = { arm: {}, leg: {} };
  for (const sg of [1, -1]) {
    const a = LA.arm[sg], b = LB.arm[sg];
    M.arm[sg] = {
      up: segMap(a.S, a.E, b.S, b.E, FRONT), fore: segMap(a.E, a.W, b.E, b.W, FRONT), hand: segMap(a.W, a.tip, b.W, b.tip, FRONT, true),
      fingers: a.fingers.map((f, i) => segMap(f.base, f.tip, b.fingers[i].base, b.fingers[i].tip, FRONT, true)),
      thumb: segMap(a.thumb.cmc, a.thumb.tip, b.thumb.cmc, b.thumb.tip, FRONT, true),
    };
    const la = LA.leg[sg], lb = LB.leg[sg];
    const ftA = la.toes[0].tip, ftB = lb.toes[0].tip;
    M.leg[sg] = {
      thigh: segMap(la.H, la.K, lb.H, lb.K, FRONT), shank: segMap(la.K, la.A, lb.K, lb.A, FRONT), foot: segMap(la.A, ftA, lb.A, ftB, UP, true),
      toes: la.toes.map((t, i) => segMap(t.base, t.tip, lb.toes[i].base, lb.toes[i].tip, UP, true)),
    };
  }
  // per-vertex weights: [torso, armUp, armFore, hand, thigh, shank, foot] for side sg
  function weights(p, region, sg) {
    const m = M.arm[sg], g = M.leg[sg];
    const w = { torso: 0, up: 0, fore: 0, hand: 0, thigh: 0, shank: 0, foot: 0 };
    let arm = 0, leg = 0;
    const a1 = m.up.param(p) * m.up.La, perp = len(sub(sub(p, m.up.a0), mul(m.up.ua, a1)));
    if (region === 'arm') arm = 1;
    else if (region === 'shoulder') arm = ss(-0.02, 0.07, a1) * ss(0.1, 0.055, perp);
    else if (region === 'armblend') arm = ss(-0.01, 0.05, a1) * ss(0.09, 0.05, perp);
    else if (region === 'skin') arm = ss(-0.015, 0.05, a1) * ss(0.085, 0.06, perp) * (sg * p[0] > 0.1 ? 1 : 0);
    const yH = g.thigh.a0[1];
    if (region === 'leg') leg = 1;
    else if (region === 'hip') leg = ss(yH + 0.03, yH - 0.07, p[1]);
    else if (region === 'legblend') leg = ss(yH + 0.02, yH - 0.06, p[1]);
    else if (region === 'skin') leg = ss(yH - 0.04, yH - 0.13, p[1]) * (Math.abs(p[0]) > 0.004 ? 1 : 0);
    if (arm > 0) {
      const tf = ss(-0.012, 0.012, m.fore.param(p) * m.fore.La), th = ss(-0.008, 0.008, m.hand.param(p) * m.hand.La);
      w.hand = arm * th; w.fore = arm * tf * (1 - th); w.up = arm * (1 - tf) * (1 - th);
    }
    if (leg > 0) {
      const ts = ss(-0.015, 0.015, g.shank.param(p) * g.shank.La), tfo = ss(0.012, -0.012, p[1] - LA.leg[sg].A[1]); // foot = below the ankle joint
      w.foot = leg * tfo; w.shank = leg * ts * (1 - tfo); w.thigh = leg * (1 - ts) * (1 - tfo);
    }
    w.torso = Math.max(0, 1 - arm - leg);
    return w;
  }
  // ---- radial fit tables (atlas skin vs app skin) for torso and long limb segments ----
  const NT = 24, NA = 24;
  const segAxis = (kind, sg) => kind === 'torso' ? null : (kind === 'up' ? M.arm[sg].up : kind === 'fore' ? M.arm[sg].fore : kind === 'thigh' ? M.leg[sg].thigh : M.leg[sg].shank);
  function axisInfo(kind, sg, q) { // q in app space -> {c, t, ang}
    if (kind === 'torso') { const t = clamp(q[1] / bT, 0, 0.9999); const i = Math.floor(t * NB); const c = [0, q[1], zB[clamp(Math.floor(q[1] / bT * NB), 0, NB - 1)]]; return { c, t, ang: Math.atan2(q[0] - c[0], q[2] - c[2]) }; }
    const S = segAxis(kind, sg); const d = sub(q, S.b0); const t = clamp(dot(d, S.ub) / S.Lb, 0, 0.9999); const c = add(S.b0, mul(S.ub, t * S.Lb)); const r = sub(q, c);
    return { c, t, ang: Math.atan2(dot(r, S.sb), dot(r, S.fb)) };
  }
  const tables = {};
  const tKey = (kind, sg) => kind + (kind === 'torso' ? '' : sg);
  function marchOut(c, dir) { if (sdfFit(c[0], c[1], c[2]) > 0) return -1; let lo = 0, hi = 0.004; while (hi < 0.45 && sdfFit(c[0] + dir[0] * hi, c[1] + dir[1] * hi, c[2] + dir[2] * hi) < 0) { lo = hi; hi += 0.004; } if (hi >= 0.45) return -1; for (let i = 0; i < 20; i++) { const m = (lo + hi) / 2; if (sdfFit(c[0] + dir[0] * m, c[1] + dir[1] * m, c[2] + dir[2] * m) < 0) lo = m; else hi = m; } return (lo + hi) / 2; }
  const skinPart = parts.find(p => p.layer === 'skin');
  for (let v = 0; v < skinPart.nv; v++) {
    const p = [skinPart.pos[v * 3], skinPart.pos[v * 3 + 1], skinPart.pos[v * 3 + 2]], sg = p[0] >= 0 ? 1 : -1;
    const w = weights(p, 'skin', sg);
    const kinds = [['torso', w.torso], ['up', w.up], ['fore', w.fore], ['thigh', w.thigh], ['shank', w.shank]].filter(k => k[1] > 0.95);
    for (const [kind] of kinds) {
      const q = kind === 'torso' ? torsoMap(p) : segAxis(kind, sg).map(p);
      const ai = axisInfo(kind, sg, q); const r = sub(q, ai.c); const Ra = kind === 'torso' ? Math.hypot(r[0], r[2]) : len(r); if (Ra < 0.01) continue;
      const dir = kind === 'torso' ? nrm([r[0], 0, r[2]]) : nrm(r);
      const Rp = marchOut(ai.c, dir); if (Rp < 0) continue;
      const key = tKey(kind, sg); const T = tables[key] || (tables[key] = { s: new Float32Array(NT * NA), n: new Float32Array(NT * NA) });
      const it = Math.floor(ai.t * NT), ia = (Math.floor((ai.ang + Math.PI) / (2 * Math.PI) * NA) + NA) % NA;
      T.s[it * NA + ia] += kind === 'torso' ? clamp(Rp / Ra, 0.8, 1.25) : clamp(Rp / Ra, 0.7, 1.4); T.n[it * NA + ia]++;
    }
  }
  for (const T of Object.values(tables)) { // average, then fill gaps from neighbours
    const r = new Float32Array(NT * NA); for (let i = 0; i < r.length; i++) r[i] = T.n[i] ? T.s[i] / T.n[i] : NaN;
    for (let pass = 0; pass < 30; pass++) { let missing = 0; for (let it = 0; it < NT; it++) for (let ia = 0; ia < NA; ia++) { const i = it * NA + ia; if (!isNaN(r[i])) continue; let s = 0, n = 0; for (const [dt, da] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const jt = it + dt, ja = (ia + da + NA) % NA; if (jt < 0 || jt >= NT) continue; const x = r[jt * NA + ja]; if (!isNaN(x)) { s += x; n++; } } if (n) r[i] = s / n; else missing++; } if (!missing) break; }
    const sm = new Float32Array(r.length); for (let it = 0; it < NT; it++) for (let ia = 0; ia < NA; ia++) { let s = 0, n = 0; for (let dt = -1; dt <= 1; dt++) for (let da = -1; da <= 1; da++) { const jt = it + dt; if (jt < 0 || jt >= NT) continue; const x = r[jt * NA + (ia + da + NA) % NA]; if (!isNaN(x)) { s += x; n++; } } sm[it * NA + ia] = n ? s / n : 1; }
    T.r = sm;
  }
  function ratio(kind, sg, ai) {
    const T = tables[tKey(kind, sg)]; if (!T) return 1;
    const ft = ai.t * NT - 0.5, fa = (ai.ang + Math.PI) / (2 * Math.PI) * NA - 0.5;
    const t0 = clamp(Math.floor(ft), 0, NT - 1), t1 = clamp(t0 + 1, 0, NT - 1), a0 = (Math.floor(fa) + NA) % NA, a1 = (a0 + 1) % NA, wt = clamp(ft - Math.floor(ft), 0, 1), wa = fa - Math.floor(fa);
    const g = (it, ia) => T.r[it * NA + ia];
    return fmix(fmix(g(t0, a0), g(t0, a1), wa), fmix(g(t1, a0), g(t1, a1), wa), wt);
  }
  function fitted(kind, sg, q, kFixed) { const ai = axisInfo(kind, sg, q); const k = kFixed !== undefined ? kFixed : ratio(kind, sg, ai); if (kind === 'torso') return [ai.c[0] + (q[0] - ai.c[0]) * k, q[1], ai.c[2] + (q[2] - ai.c[2]) * k]; return add(ai.c, mul(sub(q, ai.c), k)); }
  // ---- transform every part ----
  const out = [];
  const DEPTH = { bone: 0.003, muscle: 0.0015, cartilage: 0.003, ligament: 0.002, tendon: 0.0015, nerve: 0.003, organ: 0.006, vessel: 0.004 };
  for (const part of parts) {
    if (part.layer === 'skin') continue;
    if (P.F && ['male_repro', 'prostate'].includes(part.id)) continue;
    const region = regionOf(part), sg = part.side || (part.c[0] >= 0 ? 1 : -1);
    const isBone = part.layer === 'bone';
    // finger / toe bones follow their own digit
    let digit = null;
    if (isBone) {
      const fm = part.lname.match(/phalanx of (left|right) (index|middle|ring|little) finger/), tm = part.lname.match(/phalanx of (left|right) thumb|first metacarpal/);
      if (fm) digit = M.arm[sg].fingers[['index', 'middle', 'ring', 'little'].indexOf(fm[2])];
      else if (tm) digit = M.arm[sg].thumb;
    }
    const pos = new Float32Array(part.nv * 3);
    const wc = isBone && !digit ? weights(part.c, region, sg) : null; // bones move rigidly with one segment
    let rigidKind = null, kFix; if (wc) { rigidKind = Object.entries(wc).sort((a, b) => b[1] - a[1])[0][0]; }
    if (rigidKind && !['hand', 'foot'].includes(rigidKind)) { // one stretch value per bone, taken at its centre, so bones keep their shape
      const segMapK = rigidKind === 'torso' ? null : (rigidKind === 'up' ? M.arm[sg].up : rigidKind === 'fore' ? M.arm[sg].fore : rigidKind === 'thigh' ? M.leg[sg].thigh : M.leg[sg].shank);
      const qc = rigidKind === 'torso' ? torsoMap(part.c) : segMapK.map(part.c);
      kFix = ratio(rigidKind, sg, axisInfo(rigidKind, sg, qc));
    }
    for (let v = 0; v < part.nv; v++) {
      const p = [part.pos[v * 3], part.pos[v * 3 + 1], part.pos[v * 3 + 2]];
      let q;
      if (digit) q = digit.map(p);
      else {
        const w = rigidKind ? { torso: 0, up: 0, fore: 0, hand: 0, thigh: 0, shank: 0, foot: 0, [rigidKind]: 1 } : weights(p, region, sg);
        q = [0, 0, 0]; let tw = 0;
        const acc = (kind, wt) => { if (wt <= 0) return; let r;
          if (kind === 'torso') r = fitted('torso', sg, torsoMap(p), kFix);
          else if (kind === 'hand') r = M.arm[sg].hand.map(p); else if (kind === 'foot') r = M.leg[sg].foot.map(p);
          else r = fitted(kind, sg, (kind === 'up' ? M.arm[sg].up : kind === 'fore' ? M.arm[sg].fore : kind === 'thigh' ? M.leg[sg].thigh : M.leg[sg].shank).map(p), kFix);
          q = add(q, mul(r, wt)); tw += wt; };
        for (const k of ['torso', 'up', 'fore', 'hand', 'thigh', 'shank', 'foot']) acc(k, w[k]);
        q = mul(q, 1 / (tw || 1));
      }
      // keep inside the app body
      const dep = DEPTH[part.layer] || 0.002, e = 0.0015;
      for (let it = 0; it < 3; it++) { const d = sdfFull(q[0], q[1], q[2]); if (d <= -dep) break; let gx = sdfFull(q[0] + e, q[1], q[2]) - sdfFull(q[0] - e, q[1], q[2]), gy = sdfFull(q[0], q[1] + e, q[2]) - sdfFull(q[0], q[1] - e, q[2]), gz = sdfFull(q[0], q[1], q[2] + e) - sdfFull(q[0], q[1], q[2] - e); const gl = Math.hypot(gx, gy, gz) || 1; const k = (d + dep) / gl; q = [q[0] - gx * k, q[1] - gy * k, q[2] - gz * k]; }
      pos[v * 3] = q[0]; pos[v * 3 + 1] = q[1]; pos[v * 3 + 2] = q[2];
    }
    out.push({ ...part, pos });
  }
  return out;
}
