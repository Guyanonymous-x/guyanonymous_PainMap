// ===================== load precomputed body data =====================
// The web version fetches body-<sex>.bin next to the page; the offline file embeds it as base64.
const bodyCache = {};
async function fetchBodyBytes(sex) {
  let bytes;
  const emb = document.getElementById('data-body-' + sex);
  if (emb) {
    const r = await fetch('data:application/octet-stream;base64,' + emb.textContent.trim());
    bytes = new Uint8Array(await r.arrayBuffer());
  } else {
    // data ships as base64 text (body-<sex>.txt) next to the page
    let r = await fetch('body-' + sex + '.txt').catch(() => null);
    if (!r || !r.ok) r = await fetch('data/body-' + sex + '.txt').catch(() => null);
    if (!r || !r.ok) throw new Error('Could not load the ' + sex + ' body data. Check your connection and reload the page.');
    const b64 = (await r.text()).trim();
    bytes = new Uint8Array(await (await fetch('data:application/octet-stream;base64,' + b64)).arrayBuffer());
  }
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) { // gzip
    const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  return bytes.buffer;
}
function parseBody(buf) {
  const dv = new DataView(buf), hl = dv.getUint32(0, true);
  const H = JSON.parse(new TextDecoder().decode(new Uint8Array(buf, 4, hl)));
  const pad = x => (x + 3) & ~3; let off = pad(4 + hl);
  const take = (T, count) => { const a = new T(buf.slice(off, off + count * T.BYTES_PER_ELEMENT)); off = pad(off + count * T.BYTES_PER_ELEMENT); return a; };
  const out = { H, idx: take(Uint32Array, H.nt * 3), qpos: take(Int16Array, H.n * 3), qnor: take(Int8Array, H.n * 3), clsId: take(Uint16Array, H.n), tArr: take(Int8Array, H.n), lvl: take(Int8Array, H.n), tint: take(Uint8Array, H.n), st: [] };
  for (const s of H.st) out.st.push({ ...s, idx: take(s.big ? Uint32Array : Uint16Array, s.ni), qpos: take(Int16Array, s.nv * 3), qnor: take(Int8Array, s.nv * 3) });
  out.atlas = [];
  for (const L of (H.atlas ? H.atlas.layers : [])) out.atlas.push({ ...L, idx: take(Uint32Array, L.ni), qpos: take(Int16Array, L.nv * 3), qnor: take(Int8Array, L.nv * 3), pid: take(Uint16Array, L.nv) });
  return out;
}
async function loadBody(sex) {
  if (!bodyCache[sex]) bodyCache[sex] = parseBody(await fetchBodyBytes(sex));
  return buildBodyFromData(bodyCache[sex], sex);
}
function atlasPartColor(part, layer) {
  const base = new THREE.Color(LAYER_COLORS[layer] || 0xcccccc);
  let h = 0; for (const ch of part.name) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  if (layer === 'vessel') base.set(part.id === 'major_veins' ? 0x3d5fae : 0xc0392b);
  const hsl = {}; base.getHSL(hsl);
  const dl = layer === 'muscle' ? ((h % 9) - 4) * 0.025 : ((h % 5) - 2) * 0.015, dh = layer === 'muscle' || layer === 'organ' ? ((h >> 4) % 7 - 3) * 0.008 : 0;
  base.setHSL((hsl.h + dh + 1) % 1, hsl.s, clamp(hsl.l + dl, 0.12, 0.92));
  return [base.r, base.g, base.b];
}
function deq(qpos, Q, s) { const o = new Float32Array(qpos.length); const k = s / Q; for (let i = 0; i < qpos.length; i++) o[i] = qpos[i] * k; return o; }
function deqN(qnor) { const o = new Float32Array(qnor.length); for (let i = 0; i < qnor.length; i += 3) { const x = qnor[i], y = qnor[i + 1], z = qnor[i + 2], l = Math.hypot(x, y, z) || 1; o[i] = x / l; o[i + 1] = y / l; o[i + 2] = z / l; } return o; }
function buildBodyFromData(D, sex) {
  const t0 = performance.now();
  const H = D.H, n = H.n, P = makeParams(sex);
  const npos = deq(D.qpos, H.Q, 1), pos = deq(D.qpos, H.Q, P.s), nor = deqN(D.qnor), idx = D.idx;
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  const col = new Float32Array(n * 4); g.setAttribute('color', new THREE.BufferAttribute(col, 4));
  const skin = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.66, metalness: 0 })); skin.userData = { shell: 'skin' };
  const mpos = new Float32Array(n * 3);
  for (let i = 0; i < n * 3; i++) mpos[i] = pos[i] - nor[i] * 0.0028;
  const mg = new THREE.BufferGeometry(); mg.setAttribute('position', new THREE.BufferAttribute(mpos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); mg.setIndex(new THREE.BufferAttribute(idx.slice(), 1)); // own copy: the picking index (BVH) reorders index buffers in place
  const mcol = new Float32Array(n * 4); mg.setAttribute('color', new THREE.BufferAttribute(mcol, 4));
  const muscle = new THREE.Mesh(mg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 })); muscle.userData = { shell: 'muscle' };
  const list = H.cls, clsId = D.clsId, lvl = D.lvl;
  const tArr = new Float32Array(n); for (let v = 0; v < n; v++) tArr[v] = D.tArr[v] < 0 ? -1 : D.tArr[v] / 100;
  // vertex areas
  const varea = new Float32Array(n);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i] * 3, b = idx[i + 1] * 3, c = idx[i + 2] * 3;
    const ux = pos[b] - pos[a], uy = pos[b + 1] - pos[a + 1], uz = pos[b + 2] - pos[a + 2], wx = pos[c] - pos[a], wy = pos[c + 1] - pos[a + 1], wz = pos[c + 2] - pos[a + 2];
    const ar = Math.hypot(uy * wz - uz * wy, uz * wx - ux * wz, ux * wy - uy * wx) / 6; varea[idx[i]] += ar; varea[idx[i + 1]] += ar; varea[idx[i + 2]] += ar;
  }
  // base colours
  const skinBase = new Float32Array(n * 3), dermBase = new Float32Array(n * 3), musBase = new Float32Array(n * 3), musId = new Array(n);
  const dermCache = new Map(), musCache = new Map(), tintCols = H.tints.map(t => PART_TINT[t] || null);
  for (let v = 0; v < n; v++) {
    const R = list[clsId[v]];
    const sb = tintCols[D.tint[v]] || SKIN;
    let db = dermCache.get(R.derm); if (!db) dermCache.set(R.derm, db = dermColor(R.derm));
    const mid = R.m[0] || null; let mb = musCache.get(mid); if (!mb) musCache.set(mid, mb = muscleColor(mid));
    musId[v] = mid;
    for (let k = 0; k < 3; k++) { skinBase[v * 3 + k] = sb[k]; dermBase[v * 3 + k] = db[k]; musBase[v * 3 + k] = mb[k]; }
  }
  const mBorder = new Uint8Array(n), dBorder = new Uint8Array(n);
  for (let i = 0; i < idx.length; i += 3) {
    const a = idx[i], b = idx[i + 1], c = idx[i + 2];
    if (musId[a] !== musId[b] || musId[b] !== musId[c] || musId[a] !== musId[c]) mBorder[a] = mBorder[b] = mBorder[c] = 1;
    const da = list[clsId[a]].derm, db2 = list[clsId[b]].derm, dc = list[clsId[c]].derm;
    if (da !== db2 || db2 !== dc) dBorder[a] = dBorder[b] = dBorder[c] = 1;
  }
  for (let v = 0; v < n; v++) { if (mBorder[v]) for (let k = 0; k < 3; k++) musBase[v * 3 + k] *= 0.55; if (dBorder[v]) for (let k = 0; k < 3; k++) dermBase[v * 3 + k] *= 0.7; }
  // spatial hash
  const cell = 0.015, hash = new Map();
  for (let v = 0; v < n; v++) { const k = ((Math.floor(pos[v * 3] / cell) + 512) * 1024 + (Math.floor(pos[v * 3 + 1] / cell) + 512)) * 1024 + (Math.floor(pos[v * 3 + 2] / cell) + 512); let a = hash.get(k); if (!a) hash.set(k, a = []); a.push(v); }
  // anatomy layer meshes
  const groups = {}, byId = new Map(), meshes = [], mats = {};
  for (const layer of Object.keys(LAYER_COLORS)) { groups[layer] = new THREE.Group(); groups[layer].scale.setScalar(P.s); groups[layer].name = layer; }
  for (const s of D.st) {
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(deq(s.qpos, H.Q, 1), 3));
    sg.setAttribute('normal', new THREE.BufferAttribute(deqN(s.qnor), 3));
    sg.setIndex(new THREE.BufferAttribute(s.idx, 1));
    const mat = structMaterial(s.layer);
    const mesh = new THREE.Mesh(sg, mat); mesh.userData = { id: s.id, layer: s.layer, baseEmissive: mat.emissive.getHex() };
    groups[s.layer].add(mesh); meshes.push(mesh);
    if (!byId.has(s.id)) byId.set(s.id, []); byId.get(s.id).push(mesh);
  }
  // BodyParts3D atlas layers: one mesh per layer, per-vertex part index (for naming) and colour (for highlighting)
  const atlasParts = H.atlas ? H.atlas.parts : [], atlasMeshes = [];
  for (const L of D.atlas) {
    const ag = new THREE.BufferGeometry();
    ag.setAttribute('position', new THREE.BufferAttribute(deq(L.qpos, H.Q, 1), 3));
    ag.setAttribute('normal', new THREE.BufferAttribute(deqN(L.qnor), 3));
    ag.setIndex(new THREE.BufferAttribute(L.idx, 1));
    const col = new Float32Array(L.nv * 3), ranges = new Map();
    for (let v = 0; v < L.nv; v++) {
      const pi = L.pid[v]; let r = ranges.get(pi); if (!r) ranges.set(pi, r = [v, v + 1]); else r[1] = v + 1;
    }
    for (const [pi, r] of ranges) { const c = atlasPartColor(atlasParts[pi], L.layer); for (let v = r[0]; v < r[1]; v++) { col[v * 3] = c[0]; col[v * 3 + 1] = c[1]; col[v * 3 + 2] = c[2]; } }
    ag.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: L.layer === 'bone' ? 0.62 : 0.5, metalness: 0, side: THREE.DoubleSide, emissive: L.layer === 'nerve' ? 0x3a2a00 : 0x000000 });
    const mesh = new THREE.Mesh(ag, mat);
    mesh.userData = { atlas: true, layer: L.layer, pid: L.pid, ranges, baseCol: col.slice() };
    groups[L.layer].add(mesh); atlasMeshes.push(mesh);
  }
  const body = { P, n, pos, npos, nor, idx, varea, skin, muscle, col, mcol, clsId, list, tArr, lvl, skinBase, dermBase, musBase, musId, hash, cell, structures: { groups, byId, meshes }, atlasParts, atlasMeshes };
  body.cls = v => list[clsId[v]];
  body.musVerts = new Map(); for (let v = 0; v < n; v++) { const m = musId[v]; if (!m) continue; if (!body.musVerts.has(m)) body.musVerts.set(m, []); body.musVerts.get(m).push(v); }
  body.buildMs = performance.now() - t0;
  return body;
}
