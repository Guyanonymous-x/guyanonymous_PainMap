// ===================== build-time precompute (Node only) =====================
// Produces data/body-<sex>.bin (gzip): finished skin mesh, per-vertex anatomy mapping, and all anatomy-layer meshes.
const Q = 16000; // position quantisation: 1/16000 m (0.06 mm)
const TINTS = ['', 'eye', 'nipple', 'lips', 'glans', 'anus', 'vagina', 'labia_min', 'clitoris'];
function packBody(sex, atlasParts) {
  const t0 = Date.now();
  const d = buildBodyMesh(sex); const n = d.n;
  const SMALL = { lips: 'head', nose: 'head', eye: 'head', cheek: 'head', brow: 'head', chin: 'head', ear: 'head', nipple: 'chest' };
  const clsId = new Uint16Array(n), tArr = new Int8Array(n), lvl = new Int8Array(n), tint = new Uint8Array(n);
  const list = [], keyMap = new Map();
  // fit the atlas first, so each skin point can be labelled with the real muscle lying under it
  let fitted = null; const musHash = new Map(), MC = 0.01;
  if (atlasParts) {
    const fitPrims = buildPrims(d.P).filter(p => !['breast', 'nipple'].includes(p.tag.part));
    fitted = fitAtlas(atlasParts, d.P, makeSDF(fitPrims), d.P.sdf);
    for (const p of fitted) if (p.layer === 'muscle' && !['eye_muscles', 'throat_muscles', 'hyoid_muscles'].includes(p.id)) for (let i = 0; i < p.nv; i++) {
      const x = p.pos[i * 3], y = p.pos[i * 3 + 1], z = p.pos[i * 3 + 2], k = Math.floor(x / MC) + ',' + Math.floor(y / MC) + ',' + Math.floor(z / MC);
      let a = musHash.get(k); if (!a) musHash.set(k, a = []); a.push(x, y, z, p.id);
    }
  }
  // muscles the atlas lacks: keep the hand-made rule there (otherwise a deeper muscle would be named instead)
  const ATLAS_MISSING = new Set(['lats', 'rectus_abd', 'int_oblique', 'transversus', 'ql', 'masseter', 'temporalis', 'frontalis', 'corrugator', 'orbicularis_oculi', 'nasalis', 'levator_labii', 'zygomaticus', 'buccinator', 'orbicularis_oris', 'depressor_anguli', 'mentalis', 'occipitalis', 'multifidus', 'bulbospongiosus']);
  const nearestMuscle = (x, y, z, maxD) => {
    const cx = Math.floor(x / MC), cy = Math.floor(y / MC), cz = Math.floor(z / MC); let best = null, bd = maxD * maxD;
    for (let i = cx - 2; i <= cx + 2; i++) for (let j = cy - 2; j <= cy + 2; j++) for (let k = cz - 2; k <= cz + 2; k++) {
      const a = musHash.get(i + ',' + j + ',' + k); if (!a) continue;
      for (let q = 0; q < a.length; q += 4) { const dd = (a[q] - x) ** 2 + (a[q + 1] - y) ** 2 + (a[q + 2] - z) ** 2; if (dd < bd) { bd = dd; best = a[q + 3]; } }
    }
    return best;
  };
  for (let v = 0; v < n; v++) {
    let tag = d.addPr[d.tagIdx[v]].tag;
    if (SMALL[tag.part] && d.tagDist[v] > 0.0035) tag = { part: SMALL[tag.part] };
    const R = classify([d.npos[v * 3], d.npos[v * 3 + 1], d.npos[v * 3 + 2]], [d.nor[v * 3], d.nor[v * 3 + 1], d.nor[v * 3 + 2]], tag, d.P);
    if (fitted && R.seg !== 'head' && R.seg !== 'pelvic floor & genitals' && !ATLAS_MISSING.has(R.m[0])) {
      const mid = nearestMuscle(d.npos[v * 3], d.npos[v * 3 + 1], d.npos[v * 3 + 2], 0.02);
      if (mid) R.m = [mid, ...R.m.filter(x => x !== mid)].slice(0, 5);
    }
    tArr[v] = R.t === undefined || R.t === null ? -1 : Math.round(R.t * 100); lvl[v] = R.lvl;
    const lipOk = tag.part !== 'lips' || (Math.abs(d.npos[v * 3 + 1] - 1.578) < 0.0105 && Math.abs(d.npos[v * 3]) < 0.024 && d.nor[v * 3 + 2] > 0.2);
    tint[v] = d.tagDist[v] < 0.0035 && lipOk ? Math.max(0, TINTS.indexOf(tag.part)) : 0;
    delete R.t; delete R.lvl;
    const k = JSON.stringify(R);
    let id = keyMap.get(k); if (id === undefined) { id = list.length; keyMap.set(k, id); list.push(R); }
    clsId[v] = id;
  }
  const quantPos = (arr, scale = 1) => { const o = new Int16Array(arr.length); for (let i = 0; i < arr.length; i++) o[i] = Math.round(arr[i] * scale * Q); return o; };
  const quantNor = arr => { const o = new Int8Array(arr.length); for (let i = 0; i < arr.length; i++) o[i] = Math.round(Math.max(-1, Math.min(1, arr[i])) * 127); return o; };
  const sections = [new Uint32Array(d.idx), quantPos(d.npos), quantNor(d.nor), clsId, tArr, lvl, tint];
  // hand-built layers: keep only what the atlas does not provide (nerves, joint ligaments, tendons, menisci/labra...)
  const REPLACED = new Set(['flexor_retinac', 'spring_lig', 'achilles', 'itb', 'costal_cart', 'thyroid_cart']);
  const st = buildStructures(d.P).filter(s => s.layer !== 'bone' && s.layer !== 'muscle' && !REPLACED.has(s.id) && !s.id.startsWith('disc:')), stHead = [];
  for (const s of st) {
    const g = s.geom, nv = g.attributes.position.count, idx = g.index.array, big = nv > 65535;
    stHead.push({ layer: s.layer, id: s.id, nv, ni: idx.length, big });
    sections.push(big ? new Uint32Array(idx) : new Uint16Array(idx), quantPos(g.attributes.position.array), quantNor(g.attributes.normal.array));
  }
  // BodyParts3D atlas layers, re-posed and fitted into this body; merged per layer with a per-vertex part index
  const atHead = { parts: [], layers: [] };
  if (fitted) {
    const byLayer = {};
    for (const p of fitted) (byLayer[p.layer] ||= []).push(p);
    for (const [layer, ps] of Object.entries(byLayer)) {
      let nv = 0, ni = 0; ps.forEach(p => { nv += p.nv; ni += p.ni; });
      const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), idx = new Uint32Array(ni), pid = new Uint16Array(nv);
      let vo = 0, io = 0;
      for (const p of ps) {
        const pi = atHead.parts.length; atHead.parts.push({ name: p.name, id: p.id, layer });
        pos.set(p.pos, vo * 3);
        for (let i = 0; i < p.ni; i += 3) { // area-weighted vertex normals
          const a = p.idx[i], b = p.idx[i + 1], c = p.idx[i + 2], P0 = p.pos;
          const ux = P0[b * 3] - P0[a * 3], uy = P0[b * 3 + 1] - P0[a * 3 + 1], uz = P0[b * 3 + 2] - P0[a * 3 + 2], wx = P0[c * 3] - P0[a * 3], wy = P0[c * 3 + 1] - P0[a * 3 + 1], wz = P0[c * 3 + 2] - P0[a * 3 + 2];
          const nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx;
          for (const k of [a, b, c]) { nor[(vo + k) * 3] += nx; nor[(vo + k) * 3 + 1] += ny; nor[(vo + k) * 3 + 2] += nz; }
          idx[io + i] = vo + a; idx[io + i + 1] = vo + b; idx[io + i + 2] = vo + c;
        }
        pid.fill(pi, vo, vo + p.nv); vo += p.nv; io += p.ni;
      }
      for (let i = 0; i < nv; i++) { const l = Math.hypot(nor[i * 3], nor[i * 3 + 1], nor[i * 3 + 2]) || 1; nor[i * 3] /= l; nor[i * 3 + 1] /= l; nor[i * 3 + 2] /= l; }
      atHead.layers.push({ layer, nv, ni });
      sections.push(idx, quantPos(pos), quantNor(nor), pid);
    }
  }
  const header = new TextEncoder().encode(JSON.stringify({ v: 3, sex, n, nt: d.idx.length / 3, Q, tints: TINTS, cls: list, st: stHead, atlas: atHead }));
  const pad = x => (x + 3) & ~3;
  let size = pad(4 + header.length); for (const s of sections) size = pad(size + s.byteLength);
  const buf = new Uint8Array(size), dv = new DataView(buf.buffer);
  dv.setUint32(0, header.length, true); buf.set(header, 4);
  let off = pad(4 + header.length);
  for (const s of sections) { buf.set(new Uint8Array(s.buffer, s.byteOffset, s.byteLength), off); off = pad(off + s.byteLength); }
  return { buf, ms: Date.now() - t0, n, cls: list.length, st: stHead.length };
}
