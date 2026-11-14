// ===================== internal anatomy (3D layers) =====================
const LAYER_COLORS = { bone: 0xe9e0c9, cartilage: 0x7fbcd4, ligament: 0xd6bd6a, tendon: 0xf3f1ea, nerve: 0xf0c020, muscle: 0xb4554c, organ: 0xd99a8c, vessel: 0xc0392b };

function buildStructures(P) {
  const sdf = P.sdf, parts = new Map();
  const push = (layer, id, g) => { const k = layer + '|' + id; if (!parts.has(k)) parts.set(k, []); parts.get(k).push(g); };
  const v3 = p => new THREE.Vector3(p[0], p[1], p[2]);
  const inside = (p, depth) => {
    if (!depth) return p; const e = 0.0015; let [x, y, z] = p;
    for (let it = 0; it < 3; it++) {
      const d = sdf(x, y, z); if (d <= -depth) break;
      let gx = sdf(x + e, y, z) - sdf(x - e, y, z), gy = sdf(x, y + e, z) - sdf(x, y - e, z), gz = sdf(x, y, z + e) - sdf(x, y, z - e);
      const gl = Math.hypot(gx, gy, gz) || 1; const k = (d + depth) / gl; x -= gx * k; y -= gy * k; z -= gz * k;
    }
    return [x, y, z];
  };
  const tube = (layer, id, pts, r, depth = 0.004, r2) => {
    const P2 = pts.map(p => inside(p, depth + r));
    if (P2.length === 2) P2.splice(1, 0, lerp3(P2[0], P2[1], 0.5));
    const curve = new THREE.CatmullRomCurve3(P2.map(v3), false, 'centripetal');
    const seg = Math.max(8, P2.length * 8);
    const g = new THREE.TubeGeometry(curve, seg, r, 7, false);
    if (r2 !== undefined && r2 !== r) { // taper
      const pos = g.attributes.position, rings = seg + 1, rad = 8;
      for (let i = 0; i < rings; i++) { const t = i / seg, c = curve.getPointAt(t), s = fmix(1, r2 / r, t); for (let j = 0; j < rad; j++) { const k = i * rad + j; pos.setXYZ(k, c.x + (pos.getX(k) - c.x) * s, c.y + (pos.getY(k) - c.y) * s, c.z + (pos.getZ(k) - c.z) * s); } }
    }
    push(layer, id, g);
  };
  const ell = (layer, id, c, r, depth = 0, basis) => {
    const g = new THREE.SphereGeometry(1, 14, 10);
    const m = new THREE.Matrix4();
    if (basis) m.makeBasis(v3(basis[0]), v3(basis[1]), v3(basis[2])); else m.identity();
    m.multiply(new THREE.Matrix4().makeScale(r[0], r[1], r[2]));
    const cc = inside(c, depth); m.setPosition(cc[0], cc[1], cc[2]); g.applyMatrix4(m); push(layer, id, g);
  };
  const ring = (layer, id, c, normal, R, r, arc = Math.PI * 2) => {
    const g = new THREE.TorusGeometry(R, r, 6, 24, arc);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), v3(nrm(normal)));
    g.applyQuaternion(q); g.translate(c[0], c[1], c[2]); push(layer, id, g);
  };
  const cyl = (layer, id, a, b, r) => {
    const d = sub(b, a), L = len(d); const g = new THREE.CylinderGeometry(r, r, L, 14);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), v3(nrm(d)));
    g.applyQuaternion(q); const m = lerp3(a, b, 0.5); g.translate(m[0], m[1], m[2]); push(layer, id, g);
  };
  const plate = (layer, id, pts, depth) => {
    const p = pts.map(q => inside(q, depth)); const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(p.flat(), 3)); g.setIndex([0, 1, 2, 0, 2, 1]); g.computeVertexNormals(); push(layer, id, g);
  };
  const F = P.F, shX = P.shX;
  // ---------------- spine ----------------
  const tips = [], fronts = [];
  LEVELS.forEach((L, i) => {
    if (L.g === 'S') return;
    const y = L.y, zc = zSpine(y), k = i;
    const rb = L.g === 'C' ? 0.011 : L.g === 'T' ? 0.014 + 0.006 * ((i - 7) / 11) : 0.022;
    const sp = L.g === 'C' ? 0.0133 : L.g === 'T' ? 0.0306 : 0.026;
    cyl('bone', 'vert:' + L.name, [0, y - sp * 0.36, zc], [0, y + sp * 0.36, zc], rb);
    const spl = L.g === 'C' ? 0.022 : L.g === 'T' ? 0.03 : 0.028, drop = L.g === 'T' ? 0.022 : 0.006;
    const tip = [0, y - drop, zc - rb - spl];
    tube('bone', 'vert:' + L.name, [[0, y, zc - rb * 0.8], tip], 0.0038, 0);
    const tw = L.name === 'C1' ? 0.034 : L.g === 'C' ? 0.024 : L.g === 'T' ? 0.028 : 0.038;
    tube('bone', 'vert:' + L.name, [[-tw, y, zc - rb * 0.7], [0, y, zc - rb * 0.9], [tw, y, zc - rb * 0.7]], 0.0035, 0);
    tips.push(tip); fronts.push([0, y, zc + rb + 0.001]);
    const nx = LEVELS[i + 1];
    if (nx) {
      const my = (y + nx.y) / 2, nrb = nx.g === 'S' ? 0.022 : rb;
      cyl('cartilage', 'disc:' + L.name + '-' + nx.name, [0, my - sp * 0.12, zSpine(my)], [0, my + sp * 0.12, zSpine(my)], Math.max(rb, nrb) * 1.02);
    }
  });
  // canal, cord, roots
  const canalZ = y => zSpine(y) - (y > 1.47 ? 0.017 : y > 1.12 ? 0.024 : 0.03);
  tube('nerve', 'spinal_cord', [1.578, 1.52, 1.47, 1.4, 1.3, 1.2, 1.112].map(y => [0, y, canalZ(y)]), 0.0045, 0);
  for (const dx of [-0.004, 0, 0.004]) tube('nerve', 'cauda_equina', [1.115, 1.06, 1.0, 0.96, 0.93].map(y => [dx, y, canalZ(y)]), 0.0014, 0);
  LEVELS.forEach((L, i) => {
    if (i < 1 || (L.g === 'S' && i > LEVELS.length - 3)) return;
    const y = L.y, zc = zSpine(y);
    for (const sg of [1, -1]) {
      const dy = L.g === 'L' || L.g === 'S' ? 0.02 : L.g === 'T' ? 0.01 : 0.004;
      tube('nerve', 'root:' + L.name, [[sg * 0.004, y + 0.004, canalZ(y)], [sg * 0.02, y - dy * 0.4, zc - 0.012], [sg * 0.034, y - dy, zc - 0.004]], L.g === 'L' || L.g === 'S' ? 0.0028 : 0.0022, 0);
    }
  });
  tube('ligament', 'supraspinous_lig', tips.slice(6).map(t => [t[0], t[1], t[2] - 0.002]), 0.0022, 0);
  tube('ligament', 'nuchal_lig', [[0, 1.6, -0.07], [0, 1.54, -0.05], tips[6]], 0.003, 0.004);
  tube('ligament', 'all', fronts.slice(1), 0.0025, 0);
  // sacrum & coccyx
  const sAx = nrm([0, 0.095, 0.05]);
  ell('bone', 'sacrum', [0, 0.932, -0.062], [0.045, 0.054, 0.014], 0, [[1, 0, 0], sAx, cross([1, 0, 0], sAx)]);
  tube('bone', 'coccyx', [[0, 0.886, -0.083], [0, 0.868, -0.072]], 0.006, 0, 0.003);
  // skull & face bones
  ell('bone', 'skull', add(P.headC, [0, 0.006, -0.004]), mul(P.headR, 0.88), 0);
  ell('bone', 'facial_bones', [0, 1.602, 0.058], [0.04, 0.028, 0.03], 0);
  tube('bone', 'facial_bones', [[0, 1.66, 0.085], [0, 1.632, 0.1]], 0.0035, 0.003);
  const mand = [[-0.058, 1.605, -0.004], [-0.055, 1.562, 0.0], [-0.035, 1.542, 0.052], [0, 1.538, 0.076], [0.035, 1.542, 0.052], [0.055, 1.562, 0.0], [0.058, 1.605, -0.004]];
  tube('bone', 'mandible', mand, 0.0065, 0.004);
  for (const sg of [1, -1]) {
    tube('bone', 'facial_bones', [[sg * 0.035, 1.627, 0.076], [sg * 0.06, 1.622, 0.035], [sg * 0.064, 1.614, 0.004]], 0.0045, 0.004);
    ell('bone', 'mastoid', [sg * 0.066, 1.598, -0.022], [0.007, 0.011, 0.008], 0.004);
  }
  const arc = (y, R, zc) => { const out = []; for (let a = -70; a <= 70; a += 14) out.push([R * Math.sin(a * deg), y, zc + R * 0.85 * Math.cos(a * deg)]); return out; };
  tube('bone', 'teeth', arc(1.588, 0.028, 0.056), 0.004, 0);
  tube('bone', 'teeth', arc(1.572, 0.026, 0.055), 0.004, 0);
  // ---------------- rib cage ----------------
  const RX = [0.055, 0.08, 0.1, 0.115, 0.125, 0.13, 0.133, 0.133, 0.13, 0.125, 0.115, 0.105], RZ = [0.055, 0.065, 0.075, 0.083, 0.088, 0.09, 0.092, 0.092, 0.09, 0.087, 0.082, 0.077], DR = [0.025, 0.045, 0.06, 0.075, 0.085, 0.095, 0.105, 0.11, 0.11, 0.105, 0.045, 0.035];
  const fw = F ? 0.9 : 1, ribPts = {};
  for (let k = 1; k <= 12; k++) {
    const y0 = LEVELS[6 + k].y, zb = zSpine(y0), rx = RX[k - 1] * fw, rz = RZ[k - 1] * fw, drop = DR[k - 1];
    const ph0 = -Math.PI / 2 + 0.45, ph1 = k <= 7 ? Math.PI / 2 - 0.3 : [0.9, 0.7, 0.5, 0.05, -0.35][k - 8];
    for (const sg of [1, -1]) {
      const pts = [[sg * 0.022, y0, zb - 0.012]];
      for (let j = 0; j <= 12; j++) { const ph = ph0 + (ph1 - ph0) * j / 12; pts.push([sg * rx * Math.cos(ph), y0 - drop * Math.pow(j / 12, 1.3), -0.005 + rz * Math.sin(ph)]); }
      const P2 = pts.map(p => inside(p, 0.009));
      ribPts[k * sg] = P2;
      tube('bone', 'ribs', P2, 0.0052, 0);
      const last = P2[P2.length - 1];
      if (k <= 7) tube('cartilage', 'costal_cart', [last, [sg * 0.03, last[1] - 0.008, last[2] + 0.004], [sg * 0.017, last[1] - 0.012, last[2] + 0.006]], 0.0045, 0.008);
      else if (k <= 10) tube('cartilage', 'costal_cart', [last, [sg * 0.07, last[1] + 0.03, 0.08], [sg * 0.04, 1.21 + (10 - k) * 0.006, 0.08]], 0.004, 0.008);
      if (k >= 2 && k <= 11) tube('nerve', 'intercostal_n', P2.slice(1).map(p => [p[0], p[1] - 0.008, p[2]]), 0.0017, 0.006);
    }
  }
  ell('bone', 'sternum', [0, 1.31, F ? 0.082 : 0.088], [0.016, 0.092, 0.006], 0.006);
  tube('bone', 'xiphoid', [[0, 1.218, F ? 0.08 : 0.086], [0, 1.195, F ? 0.076 : 0.082]], 0.006, 0.006, 0.002);
  // ---------------- pelvis ----------------
  for (const sg of [1, -1]) {
    const e1 = nrm([sg * 0.075, 0, 0.135]); let e2 = nrm([sg * 0.35, 1, 0]); e2 = nrm(sub(e2, mul(e1, dot(e1, e2)))); const e3 = cross(e1, e2);
    ell('bone', 'ilium', [sg * 0.0875, 0.958, -0.0075], [0.078, 0.052, 0.012], 0.008, [e1, e2, e3]);
    ell('bone', 'asis', [sg * 0.125, 0.955, 0.062], [0.007, 0.007, 0.007], 0.008);
    ell('bone', 'psis', [sg * 0.045, 0.955, -0.075], [0.007, 0.007, 0.007], 0.008);
    tube('bone', 'pubis', [[sg * 0.008, 0.878, 0.06], [sg * 0.05, 0.89, 0.045], [sg * 0.075, 0.905, 0.02]], 0.009, 0.008);
    tube('bone', 'pubis', [[sg * 0.03, 0.866, 0.05], [sg * 0.045, 0.846, 0.012], [sg * 0.058, 0.842, -0.032]], 0.007, 0.008);
    tube('bone', 'ischium', [[sg * 0.078, 0.9, 0.0], [sg * 0.066, 0.862, -0.03], [sg * 0.06, 0.842, -0.048]], 0.0095, 0.008);
    ell('bone', 'ischium', [sg * 0.06, 0.84, -0.05], [0.012, 0.012, 0.012], 0.008);
    tube('ligament', 'si_lig', [[sg * 0.03, 0.945, -0.078], [sg * 0.06, 0.952, -0.072]], 0.003, 0.006);
    tube('ligament', 'si_lig', [[sg * 0.035, 0.915, -0.08], [sg * 0.065, 0.932, -0.068]], 0.003, 0.006);
    tube('ligament', 'sacrotuberous', [[sg * 0.025, 0.888, -0.085], [sg * 0.045, 0.86, -0.07], [sg * 0.06, 0.842, -0.056]], 0.003, 0.006);
    tube('ligament', 'inguinal_lig', [[sg * 0.125, 0.955, 0.065], [sg * 0.07, 0.91, 0.072], [sg * 0.02, 0.878, 0.07]], 0.0028, 0.005);
    tube('ligament', 'iliolumbar', [[sg * 0.02, 1.0, -0.03], [sg * 0.07, 0.98, -0.05]], 0.003, 0.006);
    tube('ligament', 'iliofemoral', [[sg * 0.1, 0.955, 0.04], [sg * 0.105, 0.92, 0.035], [sg * 0.125, 0.872, 0.02]], 0.0045, 0.01);
    ring('cartilage', 'hip_labrum', [sg * 0.084, 0.921, 0.004], [sg * 0.7, -0.5, 0.25], 0.024, 0.0035);
  }
  ell('cartilage', 'pubic_symph', [0, 0.879, 0.059], [0.004, 0.015, 0.008], 0.006);
  // ---------------- shoulder girdle & arms ----------------
  for (const A of P.arm) {
    const sg = A.sg, ar = P.ar, Lua = P.Lua, tot = P.Lua + P.Lfa;
    tube('bone', 'clavicle', [[sg * 0.018, 1.418, 0.075], [sg * 0.08, 1.428, 0.07], [sg * (shX - 0.053), 1.432, 0.035], [sg * (shX - 0.012), 1.43, 0.0]], 0.0065, 0.006);
    plate('bone', 'scapula', [[sg * 0.06, 1.43, -0.09], [sg * 0.085, 1.245, -0.088], [sg * (shX - 0.025), 1.39, -0.025]], 0.012);
    tube('bone', 'scapula', [[sg * 0.065, 1.395, -0.098], [sg * 0.13, 1.41, -0.085], [sg * (shX - 0.008), 1.428, -0.03]], 0.0048, 0.006);
    tube('bone', 'scapula', [[sg * 0.06, 1.43, -0.09], [sg * 0.085, 1.245, -0.088], [sg * (shX - 0.03), 1.37, -0.04]], 0.0035, 0.01);
    ell('bone', 'acromion', [sg * (shX - 0.01), 1.43, -0.012], [0.018, 0.006, 0.02], 0.005);
    tube('bone', 'coracoid', [[sg * (shX - 0.05), 1.4, 0.0], [sg * (shX - 0.045), 1.386, 0.035]], 0.005, 0.008);
    ell('bone', 'humerus', add(A.S, mul(A.d, -0.006)), [0.023 * ar, 0.023 * ar, 0.023 * ar], 0);
    ell('bone', 'humerus', A.pt(0.012, 0.02 * ar, 0.002), [0.011, 0.011, 0.011], 0);
    tube('bone', 'humerus', [A.S, A.E], 0.0095 * ar, 0);
    ell('bone', 'humerus', A.pt(Lua, 0.026 * ar, -0.002), [0.009, 0.009, 0.009], 0.003);
    ell('bone', 'humerus', A.pt(Lua, -0.027 * ar, -0.002), [0.01, 0.01, 0.01], 0.003);
    tube('bone', 'radius', [A.pt(Lua + 0.012, 0.014 * ar, 0.004), A.pt(tot - 0.004, 0.016 * ar, 0.002)], 0.0062 * ar, 0, 0.0095 * ar);
    tube('bone', 'ulna', [A.pt(Lua - 0.014, -0.012 * ar, -0.012), A.pt(Lua + 0.03, -0.013 * ar, -0.006), A.pt(tot - 0.004, -0.015 * ar, -0.002)], 0.009 * ar, 0, 0.0048 * ar);
    ell('bone', 'carpals', A.hp(0.016 * ar, 0, 0), [0.014 * ar, 0.028 * ar, 0.0075 * ar], 0, [A.d, A.u, [0, 0, 1]]);
    A.fingers.forEach((f, i) => {
      const b0 = A.hp(0.03 * ar, [0.026, 0.009, -0.009, -0.025][i] * ar * 0.75, 0);
      tube('bone', 'metacarpals', [b0, sub(f.pts[0], mul(f.f, 0.004))], 0.0042 * ar, 0);
      for (let s = 0; s < 3; s++) tube('bone', 'phalanges_h', [add(f.pts[s], mul(f.f, 0.003)), sub(f.pts[s + 1], mul(f.f, s === 2 ? 0.004 : 0.002))], (0.0042 - s * 0.0004) * ar, 0, (0.0034 - s * 0.0004) * ar);
      // flexor (palm) and extensor (back) tendons per finger
      tube('tendon', 'wrist_flex_t', [A.pt(tot - 0.08, [0.01, 0.004, -0.004, -0.01][i], 0.016), A.hp(0.005, [0.012, 0.004, -0.004, -0.012][i], 0.011), add(f.pts[0], [0, 0, 0.006]), add(f.pts[1], [0, 0, 0.005]), add(f.pts[2], [0, 0, 0.004]), add(lerp3(f.pts[2], f.pts[3], 0.6), [0, 0, 0.004])], 0.0016, 0.002);
      tube('tendon', 'wrist_ext_t', [A.pt(tot - 0.07, [0.012, 0.004, -0.004, -0.012][i], -0.016), A.hp(0.005, [0.014, 0.005, -0.005, -0.014][i], -0.009), add(f.pts[0], [0, 0, -0.006]), add(f.pts[1], [0, 0, -0.005]), add(lerp3(f.pts[2], f.pts[3], 0.5), [0, 0, -0.004])], 0.0015, 0.002);
    });
    const T = A.thumb;
    tube('bone', 'metacarpals', [T[0], T[1]], 0.0052 * ar, 0, 0.0045 * ar);
    tube('bone', 'phalanges_h', [T[1], T[2]], 0.0046 * ar, 0); tube('bone', 'phalanges_h', [T[2], lerp3(T[2], T[3], 0.85)], 0.004 * ar, 0, 0.003 * ar);
    // cartilage
    ring('cartilage', 'glenoid_labrum', A.pt(-0.022, 0, -0.004), [sg, -0.3, 0.1], 0.016, 0.003);
    ell('cartilage', 'tfcc', A.hp(-0.004, -0.016 * ar, 0), [0.004, 0.006, 0.006], 0);
    // ligaments
    tube('ligament', 'ac_lig', [[sg * (shX - 0.026), 1.434, 0.0], [sg * (shX - 0.005), 1.431, -0.008]], 0.0028, 0.003);
    tube('ligament', 'coracoclav', [[sg * (shX - 0.046), 1.39, 0.02], [sg * (shX - 0.046), 1.427, 0.022]], 0.003, 0.004);
    tube('ligament', 'coracoacromial', [[sg * (shX - 0.045), 1.393, 0.03], [sg * (shX - 0.01), 1.428, -0.006]], 0.0028, 0.004);
    tube('ligament', 'flexor_retinac', [A.hp(0.012 * ar, -0.022 * ar, 0.012), A.hp(0.014 * ar, 0, 0.014), A.hp(0.012 * ar, 0.024 * ar, 0.012)], 0.003, 0.002);
    tube('ligament', 'ucl_elbow', [A.pt(Lua - 0.004, -0.028 * ar, 0), A.pt(Lua + 0.03, -0.016 * ar, 0.0)], 0.003, 0.004);
    { const c = A.pt(Lua + 0.012, 0.014 * ar, 0.004); ring('ligament', 'annular_lig', c, A.d, 0.0085 * ar, 0.0022); }
    // tendons
    tube('tendon', 'rotator_cuff_t', [[sg * (shX - 0.07), 1.41, -0.055], [sg * (shX - 0.015), 1.43, -0.02], A.pt(0.02, 0.026 * ar, 0.004)], 0.005, 0.006);
    tube('tendon', 'rotator_cuff_t', [[sg * (shX - 0.06), 1.35, -0.08], A.pt(0.01, 0.01, -0.024), A.pt(0.02, 0.016, -0.02)], 0.0045, 0.006);
    tube('tendon', 'rotator_cuff_t', [[sg * (shX - 0.07), 1.35, -0.04], A.pt(0.005, -0.006, 0.022), A.pt(0.018, 0.0, 0.024)], 0.0045, 0.008);
    tube('tendon', 'biceps_long_t', [A.pt(-0.006, 0.012, 0.012), A.pt(0.04, 0.004, 0.03), A.pt(0.1, 0.0, 0.032)], 0.0028, 0.006);
    tube('tendon', 'biceps_distal_t', [A.pt(Lua - 0.05, 0, 0.03), A.pt(Lua + 0.03, 0.008, 0.012)], 0.0035, 0.006);
    tube('tendon', 'triceps_t', [A.pt(Lua - 0.07, 0, -0.032), A.pt(Lua - 0.01, -0.006, -0.026)], 0.0045, 0.005);
    tube('tendon', 'common_ext_t', [A.pt(Lua, 0.03 * ar, -0.004), A.pt(Lua + 0.06, 0.026 * ar, -0.018)], 0.0038, 0.005);
    tube('tendon', 'common_flex_t', [A.pt(Lua, -0.03 * ar, 0.0), A.pt(Lua + 0.06, -0.022 * ar, 0.018)], 0.0038, 0.005);
    tube('tendon', 'dequervain_t', [A.pt(tot - 0.09, 0.03 * ar, -0.01), A.pt(tot, 0.032 * ar, 0), T[1]], 0.0022, 0.003);
    tube('tendon', 'wrist_flex_t', [A.pt(tot - 0.08, 0.016, 0.015), A.hp(0.0, 0.014, 0.012), T[1], add(T[2], [0, 0, 0.004]), lerp3(T[2], T[3], 0.6)], 0.0016, 0.002);
    // deep muscles (shown when the muscle layer is see-through)
    // nerves of the arm
    tube('nerve', 'brachial_plexus', [[sg * 0.03, 1.495, -0.02], [sg * 0.06, 1.462, 0.0], [sg * 0.1, 1.42, 0.03], [sg * (shX - 0.045), 1.375, 0.02], A.pt(0.03, -0.035, 0.0)], 0.0055, 0.012);
    const median = [A.pt(0.03, -0.035, 0.005), A.pt(0.15, -0.03, 0.015), A.pt(Lua - 0.02, -0.01, 0.025), A.pt(Lua + 0.06, -0.002, 0.018), A.pt(tot - 0.05, 0, 0.012), A.hp(0.0, 0.0, 0.012), A.hp(0.045 * ar, 0.004, 0.01)];
    tube('nerve', 'median_n', median, 0.0028, 0.006);
    const mEnd = median[median.length - 1];
    tube('nerve', 'median_n', [mEnd, add(T[1], [0, 0, 0.006]), add(T[2], [0, 0, 0.005]), add(lerp3(T[2], T[3], 0.7), [0, 0, 0.004])], 0.0014, 0.002);
    for (const i of [0, 1, 2]) { const f = A.fingers[i]; tube('nerve', 'median_n', [mEnd, add(f.pts[0], [0, 0, 0.006]), add(f.pts[1], [0, 0, 0.005]), add(lerp3(f.pts[2], f.pts[3], 0.7), [0, 0, 0.004])].map((p, j) => j ? add(p, mul(A.u, i === 2 ? 0.004 : 0)) : p), 0.0013, 0.002); }
    const ulnar = [A.pt(0.03, -0.04, 0), A.pt(0.18, -0.04, -0.005), A.pt(Lua - 0.005, -0.032 * ar, -0.015), A.pt(Lua + 0.06, -0.025 * ar, 0), A.pt(tot - 0.03, -0.022 * ar, 0.01), A.hp(0.0, -0.022 * ar, 0.012)];
    tube('nerve', 'ulnar_n', ulnar, 0.0028, 0.006);
    for (const i of [2, 3]) { const f = A.fingers[i]; tube('nerve', 'ulnar_n', [ulnar[ulnar.length - 1], add(f.pts[0], [0, 0, 0.006]), add(f.pts[1], [0, 0, 0.005]), add(lerp3(f.pts[2], f.pts[3], 0.7), [0, 0, 0.004])].map((p, j) => j ? add(p, mul(A.u, i === 2 ? -0.004 : 0)) : p), 0.0013, 0.002); }
    tube('nerve', 'ulnar_n', [ulnar[ulnar.length - 1], A.hp(0.03, -0.03 * ar, -0.008), add(A.fingers[3].pts[1], [0, 0, -0.005])], 0.0012, 0.002);
    tube('nerve', 'radial_n', [A.pt(0.03, -0.03, -0.01), A.pt(0.1, -0.02, -0.028), A.pt(0.16, 0.015, -0.03), A.pt(0.23, 0.032, -0.005), A.pt(Lua - 0.005, 0.03 * ar, 0.012), A.pt(Lua + 0.012, 0.022, 0.002)], 0.0028, 0.006);
    tube('nerve', 'radial_n', [A.pt(Lua + 0.012, 0.022, 0.002), A.pt(Lua + 0.08, 0.0, -0.018), A.pt(Lua + 0.18, 0.0, -0.02)], 0.002, 0.008);
    tube('nerve', 'sup_radial_n', [A.pt(Lua + 0.012, 0.024, 0.004), A.pt(Lua + 0.1, 0.03 * ar, 0.0), A.pt(tot - 0.02, 0.03 * ar, -0.006), A.hp(0.03, 0.035 * ar, -0.01), add(T[2], [0, 0, -0.006])], 0.0017, 0.003);
    tube('nerve', 'sup_radial_n', [A.hp(0.03, 0.035 * ar, -0.01), add(A.fingers[0].pts[1], [0, 0, -0.005]), add(A.fingers[1].pts[1], [0, 0, -0.005])], 0.0012, 0.002);
    tube('nerve', 'axillary_n', [A.pt(0.03, -0.03, -0.01), A.pt(0.05, -0.015, -0.03), A.pt(0.07, 0.02, -0.03), A.pt(0.08, 0.04, 0.0)], 0.0022, 0.008);
    tube('nerve', 'musculocut_n', [A.pt(0.05, -0.02, 0.02), A.pt(0.15, 0.0, 0.03), A.pt(Lua - 0.02, 0.02, 0.02), A.pt(Lua + 0.12, 0.028 * ar, 0.012)], 0.002, 0.006);
    tube('nerve', 'med_cut_n', [A.pt(0.04, -0.04, 0.0), A.pt(0.2, -0.042, 0.01), A.pt(Lua + 0.1, -0.03 * ar, 0.012)], 0.0014, 0.003);
    tube('nerve', 'long_thoracic_n', [[sg * 0.05, 1.45, -0.02], [sg * 0.12, 1.36, -0.03], [sg * 0.14, 1.28, -0.02], [sg * 0.13, 1.17, 0.0]], 0.0018, 0.008);
    tube('nerve', 'suprascap_n', [[sg * 0.05, 1.46, -0.01], [sg * 0.1, 1.42, -0.05], [sg * 0.13, 1.4, -0.075], [sg * 0.15, 1.36, -0.07]], 0.002, 0.012);
    tube('nerve', 'spinal_accessory_n', [[sg * 0.05, 1.55, -0.03], [sg * 0.06, 1.48, -0.05], [sg * 0.1, 1.44, -0.07]], 0.0017, 0.008);
    tube('nerve', 'dorsal_scap_n', [[sg * 0.04, 1.48, -0.03], [sg * 0.05, 1.4, -0.08], [sg * 0.055, 1.3, -0.085]], 0.0017, 0.012);
    tube('nerve', 'thoracodorsal_n', [[sg * 0.15, 1.34, -0.02], [sg * 0.15, 1.22, -0.06]], 0.0017, 0.01);
  }
  // ---------------- legs & feet ----------------
  for (const L of P.leg) {
    const sg = L.sg, K = L.K, A = L.A;
    ell('bone', 'femur', [sg * 0.08, 0.922, 0.004], [0.022, 0.022, 0.022], 0);
    tube('bone', 'femur', [[sg * 0.08, 0.922, 0.004], [sg * 0.108, 0.9, 0.0], [sg * 0.13, 0.885, -0.004]], 0.011, 0);
    ell('bone', 'greater_troch', [sg * 0.14, 0.885, -0.006], [0.016, 0.018, 0.016], 0.01);
    tube('bone', 'femur', [[sg * 0.125, 0.87, 0.0], L.th(0.5, 0.01, 0.004), L.th(0.93, 0, -0.003)], 0.012, 0);
    for (const s of [1, -1]) ell('bone', 'femur', add(K, [s * 0.02, 0.003, -0.006]), [0.019, 0.02, 0.022], 0);
    ell('bone', 'patella', add(K, [0, 0.006, 0.038]), [0.019, 0.022, 0.007], 0.006);
    ell('cartilage', 'knee_art', add(K, [0, 0.006, 0.03]), [0.016, 0.019, 0.003], 0);
    ell('bone', 'tibia', add(K, [-sg * 0.004, -0.03, 0]), [0.037, 0.01, 0.028], 0);
    tube('bone', 'tibia', [L.sh(0.08, -0.006, 0.006), L.sh(0.5, -0.008, 0.004), L.sh(0.96, -0.01, -0.002)], 0.012, 0.005, 0.009);
    ell('bone', 'med_malleolus', add(A, [-sg * 0.022, -0.012, -0.004]), [0.009, 0.01, 0.009], 0.003);
    tube('bone', 'fibula', [L.sh(0.08, 0.036, -0.012), L.sh(0.5, 0.03, -0.012), L.sh(0.97, 0.025, -0.008)], 0.0055, 0.004);
    ell('bone', 'fibular_head', L.sh(0.07, 0.037, -0.012), [0.01, 0.01, 0.01], 0.004);
    ell('bone', 'lat_malleolus', add(A, [sg * 0.024, -0.02, -0.008]), [0.009, 0.011, 0.009], 0.003);
    ell('bone', 'talus', L.ft(0, 0.066, -0.01), [0.018, 0.015, 0.02], 0);
    ell('bone', 'calcaneus', L.ft(0, 0.034, -0.045), [0.018, 0.022, 0.032], 0.006);
    ell('bone', 'tarsals', L.ft(0.003, 0.045, 0.03), [0.03, 0.014, 0.025], 0.006);
    L.toes.forEach((t, i) => {
      const off = [-0.026, -0.002, 0.0145, 0.0295, 0.0425][i];
      tube('bone', 'metatarsals', [L.ft(off * 0.6, 0.036, 0.045), [t.a[0], t.a[1] + 0.003, t.a[2] - 0.004]], i === 0 ? 0.0065 : 0.0045, 0.004, i === 0 ? 0.0065 : 0.004);
      tube('bone', 'phalanges_f', [t.a, lerp3(t.a, t.b, 0.88)], i === 0 ? 0.0055 : 0.0035, 0.002, i === 0 ? 0.0045 : 0.0028);
      tube('tendon', 'ext_toe_t', [L.sh(0.85, 0.012, 0.03), L.ft(off * 0.6, 0.052, 0.045), add(t.a, [0, 0.005, 0]), add(lerp3(t.a, t.b, 0.8), [0, 0.004, 0])], 0.0016, 0.002);
      tube('tendon', 'flex_toe_t', [L.ft(-0.02, 0.025, -0.02), L.ft(off * 0.7, 0.012, 0.06), add(t.a, [0, -0.005, 0]), add(lerp3(t.a, t.b, 0.8), [0, -0.004, 0])], 0.0015, 0.002);
      tube('tendon', 'plantar_fascia', [L.ft(0, 0.006, -0.045), L.ft(off * 0.75, 0.006, 0.04), add(t.a, [0, -0.006, 0])], 0.0018, 0.002);
      tube('nerve', 'plantar_n', [L.ft(-0.015, 0.018, 0.0), L.ft(off * 0.8, 0.012, 0.07), add(t.a, [0, -0.004, 0]), add(lerp3(t.a, t.b, 0.75), [0, -0.003, 0])], 0.0012, 0.002);
      if (i >= 1 && i <= 3) tube('nerve', 'superficial_peroneal_n', [L.ft(0.015, 0.05, 0.07), add(t.a, [0, 0.005, 0]), add(lerp3(t.a, t.b, 0.6), [0, 0.004, 0])], 0.0011, 0.002);
    });
    // knee & ankle cartilage / ligaments
    ring('cartilage', 'meniscus_med', add(K, [-sg * 0.017, -0.021, 0]), [0, 1, 0], 0.014, 0.0033, Math.PI * 1.7);
    ring('cartilage', 'meniscus_lat', add(K, [sg * 0.017, -0.021, 0]), [0, 1, 0], 0.013, 0.0033, Math.PI * 1.9);
    tube('ligament', 'mcl', [add(K, [-sg * 0.04, 0.035, -0.006]), add(K, [-sg * 0.041, -0.01, 0.0]), add(K, [-sg * 0.036, -0.06, 0.004])], 0.0038, 0.004);
    tube('ligament', 'lcl', [add(K, [sg * 0.04, 0.03, -0.01]), L.sh(0.07, 0.04, -0.012)], 0.003, 0.004);
    tube('ligament', 'acl', [add(K, [sg * 0.006, 0.012, -0.012]), add(K, [-sg * 0.003, -0.022, 0.01])], 0.003, 0);
    tube('ligament', 'pcl', [add(K, [-sg * 0.006, 0.012, 0.002]), add(K, [sg * 0.002, -0.024, -0.018])], 0.003, 0);
    tube('ligament', 'lat_ankle_lig', [add(A, [sg * 0.025, -0.02, -0.004]), L.ft(0.018, 0.06, 0.012)], 0.0026, 0.003);
    tube('ligament', 'lat_ankle_lig', [add(A, [sg * 0.025, -0.028, -0.012]), L.ft(0.022, 0.028, -0.035)], 0.0026, 0.003);
    for (const e of [L.ft(-0.022, 0.045, 0.012), L.ft(-0.022, 0.04, -0.035), L.ft(-0.02, 0.048, -0.012)]) tube('ligament', 'deltoid_lig', [add(A, [-sg * 0.022, -0.016, -0.004]), e], 0.0026, 0.003);
    tube('ligament', 'spring_lig', [L.ft(-0.012, 0.03, -0.015), L.ft(-0.018, 0.032, 0.03)], 0.003, 0.004);
    // tendons
    tube('tendon', 'achilles', [L.sh(0.6, 0, -0.045), L.sh(0.85, 0, -0.045), L.ft(0, 0.05, -0.068)], 0.0055, 0.004);
    tube('tendon', 'patellar_t', [add(K, [0, -0.016, 0.04]), L.sh(0.17, 0, 0.035)], 0.005, 0.004);
    tube('tendon', 'quad_t', [L.th(0.8, 0, 0.05), add(K, [0, 0.03, 0.042])], 0.006, 0.004);
    tube('tendon', 'itb', [[sg * 0.15, 0.97, 0.0], L.th(0.05, 0.08, -0.005), L.th(0.3, 0.075, 0), L.th(0.6, 0.065, 0.0), L.th(0.95, 0.05, 0.005), L.sh(0.07, 0.04, 0.025)], 0.0055, 0.004);
    tube('tendon', 'hamstring_prox_t', [[sg * 0.06, 0.84, -0.06], L.th(0.25, 0, -0.055)], 0.006, 0.01);
    tube('tendon', 'hamstring_dist_t', [L.th(0.75, -0.045, -0.04), add(K, [-sg * 0.042, -0.02, -0.012]), L.sh(0.1, -0.035, 0.02)], 0.0035, 0.004);
    tube('tendon', 'hamstring_dist_t', [L.th(0.75, 0.04, -0.04), L.sh(0.07, 0.038, -0.015)], 0.0035, 0.004);
    tube('tendon', 'pes_anserine', [add(K, [-sg * 0.045, -0.01, -0.005]), L.sh(0.12, -0.03, 0.025)], 0.004, 0.004);
    tube('tendon', 'tib_ant_t', [L.sh(0.65, 0.012, 0.03), L.sh(0.92, 0.004, 0.034), L.ft(-0.018, 0.042, 0.045)], 0.003, 0.003);
    tube('tendon', 'peroneal_t', [L.sh(0.7, 0.03, -0.022), add(A, [sg * 0.03, -0.035, -0.025]), L.ft(0.038, 0.022, 0.035)], 0.0028, 0.003);
    tube('tendon', 'tib_post_t', [L.sh(0.7, -0.02, -0.022), add(A, [-sg * 0.028, -0.028, -0.022]), L.ft(-0.03, 0.035, 0.035)], 0.0028, 0.003);
    tube('tendon', 'glute_med_t', [[sg * 0.12, 0.93, -0.03], [sg * 0.15, 0.888, -0.004]], 0.005, 0.006);
    // nerves
    tube('nerve', 'lumbar_plexus', [[sg * 0.03, 1.08, -0.015], [sg * 0.035, 1.04, -0.01]], 0.004, 0.02);
    tube('nerve', 'femoral_n', [[sg * 0.035, 1.04, -0.01], [sg * 0.06, 0.96, 0.0], [sg * 0.075, 0.885, 0.06], L.th(0.2, 0, 0.06), L.th(0.4, 0.0, 0.055)], 0.0032, 0.012);
    tube('nerve', 'saphenous_n', [L.th(0.4, 0, 0.05), L.th(0.65, -0.045, 0.02), add(K, [-sg * 0.045, 0, -0.008]), L.sh(0.5, -0.04, 0), add(A, [-sg * 0.03, 0, 0.018]), L.ft(-0.032, 0.03, 0.06)], 0.0017, 0.005);
    tube('nerve', 'lfcn', [[sg * 0.04, 1.06, -0.01], [sg * 0.1, 0.98, 0.02], [sg * 0.115, 0.94, 0.065], L.th(0.25, 0.055, 0.06), L.th(0.55, 0.07, 0.04)], 0.0018, 0.005);
    tube('nerve', 'obturator_n', [[sg * 0.03, 0.97, -0.01], [sg * 0.05, 0.88, 0.03], L.th(0.3, -0.05, 0.015), L.th(0.55, -0.055, 0.0)], 0.0022, 0.01);
    tube('nerve', 'iliohypo_n', [[sg * 0.035, 1.1, -0.03], [sg * 0.1, 1.05, -0.02], [sg * 0.14, 0.99, 0.03], [sg * 0.1, 0.93, 0.075], [sg * 0.04, 0.89, 0.08], [sg * 0.02, 0.872, 0.08]], 0.0017, 0.006);
    const gfEnd = P.F ? [sg * 0.014, P.vulva.Pf[1] + 0.006, P.vulva.Pf[2]] : add(P.testes[sg > 0 ? 0 : 1], [0, 0.01, 0]);
    tube('nerve', 'genitofemoral_n', [[sg * 0.03, 1.0, 0.0], [sg * 0.05, 0.92, 0.04], [sg * 0.03, 0.885, 0.075], gfEnd], 0.0016, 0.004);
    const sciEnd = L.th(0.75, 0, -0.04);
    tube('nerve', 'sciatic_n', [[sg * 0.03, 0.97, -0.04], [sg * 0.06, 0.9, -0.07], [sg * 0.085, 0.86, -0.075], L.th(0.25, 0, -0.055), L.th(0.5, 0, -0.045), sciEnd], 0.0055, 0.015);
    tube('nerve', 'tibial_n', [sciEnd, add(K, [0, 0, -0.035]), L.sh(0.3, 0.003, -0.03), L.sh(0.75, -0.012, -0.025), add(A, [-sg * 0.028, -0.005, -0.03]), L.ft(-0.015, 0.018, 0.0)], 0.0035, 0.01);
    tube('nerve', 'common_peroneal_n', [sciEnd, add(K, [sg * 0.03, 0.015, -0.035]), L.sh(0.07, 0.045, -0.005), L.sh(0.12, 0.042, 0.005)], 0.003, 0.006);
    tube('nerve', 'superficial_peroneal_n', [L.sh(0.12, 0.042, 0.005), L.sh(0.35, 0.04, 0.0), L.sh(0.85, 0.03, 0.02), L.ft(0.015, 0.05, 0.07)], 0.0018, 0.006);
    tube('nerve', 'deep_peroneal_n', [L.sh(0.12, 0.04, 0.01), L.sh(0.45, 0.01, 0.025), L.sh(0.9, 0.0, 0.03), L.ft(-0.012, 0.042, 0.1), lerp3(L.toes[0].a, L.toes[1].a, 0.5)], 0.0018, 0.008);
    tube('nerve', 'sural_n', [add(K, [0, -0.01, -0.04]), L.sh(0.35, 0.005, -0.06), L.sh(0.7, 0.018, -0.04), add(A, [sg * 0.03, -0.02, -0.035]), L.ft(0.038, 0.025, 0.04), add(L.toes[4].a, [0, 0, 0])], 0.0016, 0.004);
    tube('nerve', 'post_fem_cut_n', [[sg * 0.06, 0.88, -0.08], L.th(0.3, 0, -0.06), L.th(0.7, 0, -0.05)], 0.0016, 0.004);
    tube('nerve', 'sup_gluteal_n', [[sg * 0.05, 0.93, -0.07], [sg * 0.12, 0.95, -0.06]], 0.002, 0.02);
    tube('nerve', 'inf_gluteal_n', [[sg * 0.07, 0.87, -0.08], [sg * 0.1, 0.87, -0.1]], 0.002, 0.02);
    tube('nerve', 'cluneal_n', [[sg * 0.05, 1.02, -0.085], [sg * 0.09, 0.97, -0.1]], 0.0013, 0.004);
    const pudEnd = P.F ? P.vulva.Pf : P.penis.root;
    tube('nerve', 'pudendal_n', [[sg * 0.02, 0.9, -0.07], [sg * 0.045, 0.865, -0.05], [sg * 0.045, 0.845, -0.02], [sg * 0.02, 0.845, 0.03], add(pudEnd, [sg * 0.006, 0.004, -0.008])], 0.0022, 0.006);
    if (!P.F) tube('nerve', 'pudendal_n', [add(P.penis.root, [sg * 0.004, 0.006, -0.004]), add(P.penis.end, [sg * 0.004, 0.008, 0]), add(P.penis.tip, [sg * 0.003, 0.004, -0.008])], 0.0011, 0.002);
    tube('nerve', 'pudendal_n', [[sg * 0.045, 0.85, -0.035], add(P.anus, [sg * 0.01, 0.006, 0])], 0.0012, 0.004);
    // deep muscles
    tube('muscle', 'iliopsoas', [[sg * 0.025, 1.11, -0.02], [sg * 0.045, 1.0, -0.005], [sg * 0.07, 0.92, 0.03], [sg * 0.08, 0.88, 0.04], L.th(0.18, -0.03, 0.01)], 0.014, 0.02, 0.008);
    tube('muscle', 'piriformis', [[sg * 0.03, 0.925, -0.07], [sg * 0.08, 0.905, -0.065], [sg * 0.13, 0.89, -0.03]], 0.0095, 0.02, 0.005);
    tube('muscle', 'ql', [[sg * 0.05, 1.12, -0.045], [sg * 0.065, 1.06, -0.05], [sg * 0.075, 1.0, -0.045]], 0.013, 0.02);
  }
  // pelvic floor & perineal muscles
  { const g = new THREE.SphereGeometry(0.055, 20, 10, 0, Math.PI * 2, Math.PI * 0.62, Math.PI * 0.38); g.scale(1, 0.55, 1.25); g.translate(0, 0.885, -0.005); push('muscle', 'pelvic_floor', g); }
  ring('muscle', 'anal_sphincter', add(P.anus, [0, 0.007, 0]), [0, 1, 0], 0.009, 0.0033);
  tube('muscle', 'bulbospongiosus', [[0, 0.846, -0.004], [0, 0.852, 0.03], P.F ? add(P.vulva.Pf, [0, 0.008, -0.004]) : add(P.penis.root, [0, -0.004, -0.006])], 0.0055, 0.006);
  // face & head nerves
  for (const sg of [1, -1]) {
    tube('nerve', 'greater_occ_n', [[sg * 0.015, 1.535, -0.05], [sg * 0.025, 1.58, -0.07], [sg * 0.032, 1.64, -0.086], [sg * 0.028, 1.7, -0.065]], 0.0017, 0.003);
    tube('nerve', 'lesser_occ_n', [[sg * 0.04, 1.53, -0.03], [sg * 0.06, 1.585, -0.05], [sg * 0.058, 1.64, -0.05]], 0.0013, 0.003);
    tube('nerve', 'great_auric_n', [[sg * 0.045, 1.52, -0.01], [sg * 0.055, 1.565, 0.0], [sg * 0.062, 1.6, 0.005]], 0.0013, 0.003);
    tube('nerve', 'trigeminal_v1', [[sg * 0.024, 1.668, 0.088], [sg * 0.028, 1.7, 0.085], [sg * 0.03, 1.73, 0.07]], 0.0014, 0.003);
    tube('nerve', 'trigeminal_v1', [[sg * 0.012, 1.668, 0.09], [sg * 0.012, 1.71, 0.085]], 0.0011, 0.003);
    tube('nerve', 'trigeminal_v2', [[sg * 0.028, 1.628, 0.09], [sg * 0.026, 1.61, 0.098], [sg * 0.018, 1.594, 0.1]], 0.0014, 0.003);
    tube('nerve', 'trigeminal_v2', [[sg * 0.028, 1.628, 0.09], [sg * 0.04, 1.612, 0.088]], 0.0011, 0.003);
    tube('nerve', 'trigeminal_v3', [[sg * 0.022, 1.56, 0.085], [sg * 0.012, 1.553, 0.09], [sg * 0.008, 1.566, 0.096]], 0.0013, 0.003);
    tube('nerve', 'trigeminal_v3', [[sg * 0.068, 1.598, 0.004], [sg * 0.07, 1.64, 0.012], [sg * 0.068, 1.68, 0.02]], 0.0012, 0.003);
    const fn0 = [sg * 0.06, 1.6, -0.012], fn1 = [sg * 0.066, 1.596, 0.016];
    tube('nerve', 'facial_n', [fn0, fn1], 0.0022, 0.006);
    for (const e of [[[sg * 0.066, 1.64, 0.04], [sg * 0.058, 1.68, 0.065]], [[sg * 0.06, 1.625, 0.06], [sg * 0.045, 1.64, 0.082]], [[sg * 0.055, 1.6, 0.06], [sg * 0.035, 1.59, 0.09]], [[sg * 0.05, 1.565, 0.05], [sg * 0.03, 1.552, 0.078]], [[sg * 0.055, 1.54, 0.03], [sg * 0.045, 1.51, 0.04]]]) tube('nerve', 'facial_n', [fn1, ...e], 0.0014, 0.004);
    ell('cartilage', 'tmj_disc', [sg * 0.06, 1.604, 0.006], [0.004, 0.003, 0.005], 0);
  }
  ell('cartilage', 'thyroid_cart', [0, 1.505, 0.04], [0.016, 0.014, 0.008], 0.004);
  tube('cartilage', 'thyroid_cart', [[0, 1.49, 0.032], [0, 1.45, 0.024], [0, 1.42, 0.02]], 0.0085, 0.006);
  // ----- assemble: one indexed geometry per (layer, id) -----
  const out = [];
  for (const [k, gs] of parts) {
    const [layer, id] = k.split('|');
    const clean = gs.map(g => { if (g.attributes.uv) g.deleteAttribute('uv'); if (!g.attributes.normal) g.computeVertexNormals(); if (!g.index) { const n = g.attributes.position.count; g.setIndex([...Array(n).keys()]); } return g; });
    const geom = clean.length === 1 ? clean[0] : mergeGeometries(clean, false);
    if (geom) out.push({ layer, id, geom });
  }
  return out;
}
function structMaterial(layer) {
  return new THREE.MeshStandardMaterial({ color: LAYER_COLORS[layer], roughness: layer === 'bone' ? 0.6 : layer === 'nerve' ? 0.4 : 0.5, metalness: 0, emissive: layer === 'nerve' ? 0x3a2a00 : 0x000000, side: layer === 'bone' ? THREE.DoubleSide : THREE.FrontSide });
}
