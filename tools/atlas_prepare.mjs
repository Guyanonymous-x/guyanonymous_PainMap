// Step 1 of the atlas pipeline (run once after downloading BodyParts3D):
//   node tools/atlas_prepare.mjs
// Reads atlas/obj_isa/*/FJ*.obj, keeps the layers the app uses, simplifies each part with meshoptimizer,
// converts to app axes (metres, Y up, +Z front, +X patient's left) and writes atlas/cache/atlas.bin + atlas.json.
// BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.
import fs from 'fs'; import path from 'path'; import { fileURLToPath, pathToFileURL } from 'url';
import { MeshoptSimplifier } from 'meshoptimizer';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..');
// load the mapping code (plain script) into a module
let code = fs.readFileSync(path.join(root, 'src/a_body.js'), 'utf8') + fs.readFileSync(path.join(root, 'src/b_db.js'), 'utf8') + fs.readFileSync(path.join(root, 'src/x_atlas_parts.js'), 'utf8') + '\nexport { atlasLayer, atlasId };\n';
fs.writeFileSync(path.join(here, '_atlas_map.mjs'), code);
const { atlasLayer, atlasId } = await import(pathToFileURL(path.join(here, '_atlas_map.mjs')).href);
await MeshoptSimplifier.ready;

const objDir = path.join(root, 'atlas/obj_isa'); const sub = fs.readdirSync(objDir)[0]; const dir = path.join(objDir, sub);
// target fraction of triangles kept, per layer
const KEEP = { bone: 0.22, muscle: 0.25, cartilage: 0.3, ligament: 0.5, tendon: 0.3, nerve: 0.4, organ: 0.18, vessel: 0.15, skin: 0.2 };
const MINTRI = { bone: 60, muscle: 50, cartilage: 40, ligament: 40, tendon: 40, nerve: 30, organ: 40, vessel: 30, skin: 1000 };
const FLOOR_MM = -78.1112; // lowest point of the skin (soles)
function parseObj(file) {
  const txt = fs.readFileSync(file, 'utf8'); const v = [], f = []; let name = '';
  for (const line of txt.split('\n')) {
    if (line.startsWith('v ')) { const p = line.split(/\s+/); v.push(+p[1], +p[2], +p[3]); }
    else if (line.startsWith('f ')) { const p = line.trim().split(/\s+/).slice(1).map(s => parseInt(s, 10) - 1); for (let i = 1; i + 1 < p.length; i++) f.push(p[0], p[i], p[i + 1]); }
    else if (line.startsWith('# English name')) name = line.split(':').slice(1).join(':').trim();
  }
  return { name, v: new Float32Array(v), f: new Uint32Array(f) };
}
const parts = [], blobs = []; let totIn = 0, totOut = 0; const perLayer = {};
const files = fs.readdirSync(dir).filter(f => f.endsWith('.obj')).sort();
for (const file of files) {
  const { name, v, f } = parseObj(path.join(dir, file));
  const layer = atlasLayer(name); if (!layer) continue;
  // atlas mm (X left+, Y back+, Z up) -> app metres (X left+, Y up, Z front+)
  const n = v.length / 3, pos = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { pos[i * 3] = v[i * 3] / 1000; pos[i * 3 + 1] = (v[i * 3 + 2] - FLOOR_MM) / 1000; pos[i * 3 + 2] = -v[i * 3 + 1] / 1000; }
  // vertex clustering on a grid (cell size per layer), which also welds duplicate vertices;
  // the atlas meshes are open surfaces, so edge-collapse simplification alone stalls at their borders
  const CELL = { bone: 0.0018, muscle: 0.003, cartilage: 0.0016, ligament: 0.0022, tendon: 0.0022, nerve: 0.0009, organ: 0.0045, vessel: 0.0025, skin: 0.005 }[layer];
  const weld = new Map(), wmap = new Uint32Array(n), acc = [];
  for (let i = 0; i < n; i++) {
    const k = Math.floor(pos[i * 3] / CELL) + ',' + Math.floor(pos[i * 3 + 1] / CELL) + ',' + Math.floor(pos[i * 3 + 2] / CELL);
    let w = weld.get(k); if (w === undefined) { w = i; weld.set(k, i); acc[i] = [0, 0, 0, 0]; }
    const a = acc[w]; a[0] += pos[i * 3]; a[1] += pos[i * 3 + 1]; a[2] += pos[i * 3 + 2]; a[3]++; wmap[i] = w;
  }
  for (const w of weld.values()) { const a = acc[w]; pos[w * 3] = a[0] / a[3]; pos[w * 3 + 1] = a[1] / a[3]; pos[w * 3 + 2] = a[2] / a[3]; }
  const fw = new Uint32Array(f.length); let fk = 0;
  for (let i = 0; i < f.length; i += 3) { const a = wmap[f[i]], b = wmap[f[i + 1]], c = wmap[f[i + 2]]; if (a === b || b === c || a === c) continue; fw[fk++] = a; fw[fk++] = b; fw[fk++] = c; }
  const fwe = fw.slice(0, fk);
  const target = Math.max(MINTRI[layer] * 3, Math.floor(fwe.length * KEEP[layer] / 3) * 3); // KEEP is relative to the welded mesh
  let idx = fwe; const f0 = fwe;
  if (target < f0.length) {
    idx = MeshoptSimplifier.simplify(f0, pos, 3, target, 0.08, [])[0];
    if (idx.length > target * 1.5) idx = MeshoptSimplifier.simplify(f0, pos, 3, target, 0.2, [])[0]; // stubborn meshes
    if (idx.length < 3 * 12) idx = MeshoptSimplifier.simplify(f0, pos, 3, target * 2, 0.02, [])[0];
  }
  // compact vertices
  const remap = new Int32Array(n).fill(-1); const outV = []; const outI = new Uint32Array(idx.length); let m = 0;
  for (let i = 0; i < idx.length; i++) { const o = idx[i]; if (remap[o] < 0) { remap[o] = m++; outV.push(pos[o * 3], pos[o * 3 + 1], pos[o * 3 + 2]); } outI[i] = remap[o]; }
  const fv = new Float32Array(outV);
  let cx = 0, cy = 0, cz = 0; for (let i = 0; i < m; i++) { cx += fv[i * 3]; cy += fv[i * 3 + 1]; cz += fv[i * 3 + 2]; }
  parts.push({ file: file.slice(0, -4), name, layer, id: atlasId(name, layer), nv: m, ni: outI.length, c: [cx / m, cy / m, cz / m] });
  blobs.push(fv, outI);
  totIn += f.length / 3; totOut += outI.length / 3; (perLayer[layer] ||= [0, 0, 0]); perLayer[layer][0]++; perLayer[layer][1] += f.length / 3; perLayer[layer][2] += outI.length / 3;
}
fs.mkdirSync(path.join(root, 'atlas/cache'), { recursive: true });
const size = blobs.reduce((s, b) => s + b.byteLength, 0), buf = Buffer.alloc(size); let off = 0;
for (const b of blobs) { Buffer.from(b.buffer, b.byteOffset, b.byteLength).copy(buf, off); off += b.byteLength; }
fs.writeFileSync(path.join(root, 'atlas/cache/atlas.bin'), buf);
fs.writeFileSync(path.join(root, 'atlas/cache/atlas.json'), JSON.stringify(parts));
console.log('parts', parts.length, 'triangles', totIn, '->', totOut);
for (const [k, v] of Object.entries(perLayer)) console.log(' ', k.padEnd(10), String(v[0]).padStart(4), 'parts', String(v[1]).padStart(8), '->', v[2], 'tris');
