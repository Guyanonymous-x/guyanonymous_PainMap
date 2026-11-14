// Run: node tools/precompute.mjs   (writes data/body-male.bin and data/body-female.bin, gzip-compressed)
// Needs atlas/cache from tools/atlas_prepare.mjs (BodyParts3D, CC BY 4.0). Without it, only the hand-built layers are used.
import fs from 'fs'; import path from 'path'; import zlib from 'zlib'; import { fileURLToPath, pathToFileURL } from 'url';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..'), src = path.join(root, 'src');
let code = "import * as THREE from 'three';\nimport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\n";
for (const f of ['a_body.js', 'b_db.js', 'c_classify.js', 'd_structures.js', 'x_atlas_parts.js', 'x_atlas_fit.js', 'x_precompute.js']) code += fs.readFileSync(path.join(src, f), 'utf8') + '\n';
code += 'export { packBody, loadAtlasCache };\n';
const gen = path.join(here, '_gen.mjs'); fs.writeFileSync(gen, code);
const { packBody, loadAtlasCache } = await import(pathToFileURL(gen).href);
const cacheDir = path.join(root, 'atlas', 'cache');
const atlas = fs.existsSync(path.join(cacheDir, 'atlas.json')) ? loadAtlasCache(fs, cacheDir) : null;
console.log(atlas ? `atlas: ${atlas.length} parts` : 'atlas cache not found: hand-built layers only');
fs.mkdirSync(path.join(root, 'data'), { recursive: true });
for (const sex of ['male', 'female']) {
  const r = packBody(sex, atlas);
  const gz = zlib.gzipSync(r.buf, { level: 9 });
  fs.writeFileSync(path.join(root, 'data', `body-${sex}.bin`), gz);
  console.log(sex, 'verts', r.n, 'zones', r.cls, 'layer meshes', r.st, 'raw', (r.buf.length / 1e6).toFixed(2) + 'MB', 'gz', (gz.length / 1e6).toFixed(2) + 'MB', 'build', r.ms + 'ms');
}
