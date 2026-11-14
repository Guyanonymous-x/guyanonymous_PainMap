// ===================== app =====================
const QUAL = [
  { k: 'aching', label: 'Aching / dull', color: '#e3832f', desc: 'dull, aching pain' },
  { k: 'sharp', label: 'Sharp / stabbing', color: '#d42f2f', desc: 'sharp, stabbing pain' },
  { k: 'burning', label: 'Burning', color: '#c2318b', desc: 'burning pain' },
  { k: 'shooting', label: 'Shooting / electric', color: '#0e9fb4', desc: 'shooting, electric-shock-like pain' },
  { k: 'tingling', label: 'Tingling / pins & needles', color: '#c9a800', desc: 'tingling / pins-and-needles (paraesthesia)' },
  { k: 'numb', label: 'Numbness', color: '#4f74cc', desc: 'numbness or reduced feeling (hypoaesthesia)' },
  { k: 'throbbing', label: 'Throbbing / pulsing', color: '#8547cf', desc: 'throbbing, pulsing pain' },
  { k: 'cramp', label: 'Cramping / spasm', color: '#9e1d48', desc: 'cramping or spasm' },
  { k: 'stiff', label: 'Stiffness / tightness', color: '#8a6640', desc: 'stiffness and tightness' },
  { k: 'tender', label: 'Tender to touch', color: '#2e9a58', desc: 'tenderness when pressed or touched' },
  { k: 'weak', label: 'Weakness', color: '#66707c', desc: 'weakness (reduced strength)' },
];
const QMAP = Object.fromEntries(QUAL.map(q => [q.k, q]));
const TIMING = ['Constant', 'Comes and goes', 'Worse in the morning', 'Worse at night / wakes me', 'Worse at end of day', 'Only with certain movements', 'After activity', 'After staying still a long time'];
const AGGR = ['Bending forward', 'Bending backward', 'Twisting', 'Sitting', 'Standing', 'Walking', 'Running', 'Stairs', 'Lifting', 'Reaching overhead', 'Reaching behind', 'Gripping / pinching', 'Typing / mouse', 'Turning the head', 'Looking down', 'Looking up', 'Lying on it', 'Getting up from a chair', 'Coughing / sneezing', 'Deep breath', 'Pressing on it', 'Squatting / kneeling', 'Chewing / talking', 'Sexual activity', 'Bowel movement', 'Urinating', 'Cold weather', 'Stress'];
const RELIEF = ['Rest', 'Moving around', 'Heat', 'Ice / cold', 'Stretching', 'Massage / pressure', 'Pain medication', 'Anti-inflammatory', 'Changing position', 'Lying down', 'Sleep', 'Nothing helps'];
const DEPTH = [['unsure', 'Not sure'], ['surface', 'On the skin / surface'], ['muscle', 'In the muscle'], ['deep', 'Deep (joint or bone)']];
const ONSET = ['', 'Sudden', 'Gradual', 'After an injury', 'After a specific activity', 'After surgery', 'Not sure'];
const RED_FLAGS = ['Numbness in the groin/saddle area or genitals', 'New bladder or bowel control problems', 'Weakness that is getting worse', 'Fever or feeling unwell with the pain', 'Unexplained weight loss', 'History of cancer', 'Pain began after a significant fall or accident', 'Severe night pain not eased by any position', 'Chest pain/pressure or shortness of breath', 'Sudden, severe headache', 'Calf swelling, redness or warmth', 'Sudden severe testicle or pelvic pain'];
const LAYERS = [['skin', 'Skin (surface)', '#d9cbbd'], ['muscle', 'Muscles', '#b4554c'], ['tendon', 'Tendons & fascia', '#efece2'], ['ligament', 'Ligaments', '#d6bd6a'], ['cartilage', 'Cartilage & discs', '#7fbcd4'], ['bone', 'Bones', '#e9e0c9'], ['nerve', 'Nerves', '#f0c020'], ['vessel', 'Major blood vessels', '#c0392b'], ['organ', 'Organs', '#d99a8c'], ['marks', 'Pain marks', '#e3832f']];
const INNER = ['muscle', 'tendon', 'ligament', 'cartilage', 'bone', 'nerve', 'vessel', 'organ'];
const defAttrs = () => ({ intensity: 5, worst: 7, depth: 'unsure', timing: [], onset: '', duration: '', aggr: [], relief: [], notes: '', dir: 'out', pressRepro: false, pressRefers: false });

const $ = s => document.querySelector(s), $$ = s => [...document.querySelectorAll(s)];
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const S = {
  sex: 'male', tool: 'brush', quality: 'aching', brush: 0.025,
  marks: [], selId: null, nextId: 1,
  layers: { skin: true, muscle: false, tendon: false, ligament: false, cartilage: false, bone: false, nerve: false, vessel: false, organ: false, marks: true },
  skinMode: 'skin', xray: 0.22, purpose: 'physician', example: false,
  patient: { perspective: 'self', age: '', height: '', weight: '', hand: '', activity: '', occupation: '', story: '', conditions: '', meds: '', tried: '', goals: '', questions: '', flags: [], noFlags: false, extra: '' },
};
let B = null; // current body
const undoStack = [];

// ---------- three setup ----------
const canvas = $('#c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 0.02, 30);
camera.position.set(0, 1.0, 3.4);
const controls = new OrbitControls(camera, canvas);
controls.target.set(0, 0.92, 0); controls.enableDamping = true; controls.dampingFactor = 0.12; controls.minDistance = 0.18; controls.maxDistance = 7; controls.zoomSpeed = 1.1;
scene.add(new THREE.HemisphereLight(0xffffff, 0x8c8278, 1.15));
const key = new THREE.DirectionalLight(0xffffff, 1.5); key.position.set(1.5, 2.5, 3); scene.add(key);
const rim = new THREE.DirectionalLight(0xc8dcff, 0.7); rim.position.set(-2, 1.5, -3); scene.add(rim);
const fill = new THREE.DirectionalLight(0xffffff, 0.45); fill.position.set(0, -2, 1); scene.add(fill);
{ // floor disc
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64); gr.addColorStop(0, 'rgba(0,0,0,0.28)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthWrite: false }));
  m.rotation.x = -Math.PI / 2; m.position.y = -0.001; scene.add(m);
}
function sideSprite(text, x) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 128; const g = c.getContext('2d');
  g.fillStyle = 'rgba(11,110,116,0.92)'; g.beginPath(); g.roundRect(8, 8, 240, 112, 26); g.fill();
  g.fillStyle = '#fff'; g.font = '600 46px IBM Plex Sans, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 66);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.scale.set(0.2, 0.1, 1); s.position.set(x, 0.05, 0.1); s.renderOrder = 10; scene.add(s); return s;
}
sideSprite('LEFT', 0.42); sideSprite('RIGHT', -0.42);
const marksGroup = new THREE.Group(); scene.add(marksGroup);
const cursorRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.06, 6, 40), new THREE.MeshBasicMaterial({ color: 0x0b6e74, transparent: true, opacity: 0.85, depthTest: false }));
cursorRing.renderOrder = 11; cursorRing.visible = false; scene.add(cursorRing);
// path start / end indicators
function tagSprite(text, bg) {
  const c = document.createElement('canvas'); c.width = 256; c.height = 96; const g = c.getContext('2d');
  g.fillStyle = bg; g.beginPath(); g.roundRect(6, 6, 244, 84, 20); g.fill();
  g.fillStyle = '#fff'; g.font = '700 46px IBM Plex Sans, system-ui, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, 128, 50);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
  s.renderOrder = 12; s.userData.aspect = 256 / 96; s.visible = false; return s;
}
const START_COL = '#1f8f4e', END_COL = '#c0392b';
const startTag = tagSprite('START', START_COL), endTag = tagSprite('END', END_COL);
const startRing = new THREE.Mesh(new THREE.TorusGeometry(1, 0.12, 6, 32), new THREE.MeshBasicMaterial({ color: START_COL, depthTest: false, transparent: true }));
startRing.renderOrder = 11; startRing.visible = false;
scene.add(startTag, endTag, startRing);
function placeTag(tag, point, n) { // keep tags a readable size on screen at any zoom
  const d = camera.position.distanceTo(point), h = d * 0.028;
  tag.scale.set(h * tag.userData.aspect, h, 1); tag.position.copy(point).addScaledVector(n, 0.004).add(new THREE.Vector3(0, h * 0.9, 0)); tag.visible = true;
}
function placeRing(ring, point, n, r) { ring.position.copy(point).addScaledVector(n, 0.002); ring.scale.setScalar(r); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n); ring.visible = true; }
function hidePathTags() { startTag.visible = endTag.visible = startRing.visible = false; }

function resize() {
  const r = canvas.parentElement.getBoundingClientRect();
  renderer.setSize(r.width, r.height, false); camera.aspect = r.width / Math.max(1, r.height); camera.updateProjectionMatrix();
}
new ResizeObserver(resize).observe(canvas.parentElement);

// ---------- BVH (optional, speeds up picking) ----------
let BVH = null;
import('https://cdn.jsdelivr.net/npm/three-mesh-bvh@0.7.6/build/index.module.js').then(m => { BVH = m; if (B) applyBVH(); }).catch(() => { });
function applyBVH() {
  if (!BVH || !B) return;
  for (const mesh of [B.skin, B.muscle]) { mesh.geometry.boundsTree = new BVH.MeshBVH(mesh.geometry); mesh.raycast = BVH.acceleratedRaycast; }
}

// ---------- colors ----------
const hex = h => { const c = new THREE.Color(h); return [c.r, c.g, c.b]; };
const SKIN = hex('#d9cbbd');
const PART_TINT = { eye: hex('#eef0f0'), nipple: hex('#b98576'), lips: hex('#c4877f'), glans: hex('#c78c82'), anus: hex('#a46a68'), vagina: hex('#b06f72'), labia_min: hex('#c08482'), clitoris: hex('#c58682') };
function dermColor(d) {
  if (!d) return [0.8, 0.8, 0.8];
  const m = d.match(/[CTLSV]\d/); if (!m) return [0.8, 0.8, 0.8];
  const g = m[0][0], i = parseInt(m[0].slice(1));
  const c = new THREE.Color();
  if (g === 'V') c.setHSL(0.5, 0.25, 0.45 + i * 0.1);
  else if (g === 'C') c.setHSL(0.6 - i * 0.012, 0.6, 0.38 + (i % 2) * 0.16 + i * 0.01);
  else if (g === 'T') c.setHSL(0.3 + i * 0.008, 0.45, 0.36 + (i % 2) * 0.16);
  else if (g === 'L') c.setHSL(0.08 + i * 0.01, 0.7, 0.42 + (i % 2) * 0.14);
  else c.setHSL(0.8 - i * 0.02, 0.45, 0.4 + (i % 2) * 0.14);
  return [c.r, c.g, c.b];
}
function muscleColor(id) {
  if (!id) return hex('#e6d8c6');
  let h = 0; for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = new THREE.Color().setHSL(((h % 50) - 25) / 360 + 0.995, 0.5 + (h % 7) * 0.035, 0.36 + ((h >> 3) % 9) * 0.025);
  return [c.r, c.g, c.b];
}

// ---------- body build ----------
function setLoading(msg) { const el = $('#loading'); if (msg) { el.hidden = false; $('#loadingMsg').textContent = msg; } else el.hidden = true; }

function radiusQuery(p, r, cb) {
  const c = B.cell, x0 = Math.floor((p[0] - r) / c), x1 = Math.floor((p[0] + r) / c), y0 = Math.floor((p[1] - r) / c), y1 = Math.floor((p[1] + r) / c), z0 = Math.floor((p[2] - r) / c), z1 = Math.floor((p[2] + r) / c);
  const pos = B.pos, r2 = r * r;
  for (let i = x0; i <= x1; i++) for (let j = y0; j <= y1; j++) for (let k = z0; k <= z1; k++) {
    const a = B.hash.get(((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512)); if (!a) continue;
    for (const v of a) { const dx = pos[v * 3] - p[0], dy = pos[v * 3 + 1] - p[1], dz = pos[v * 3 + 2] - p[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 <= r2) cb(v, Math.sqrt(d2)); }
  }
}
function nearestVertex(body, p, useNorm) { // p in world (or normalized if useNorm)
  const arr = useNorm ? body.npos : body.pos; let best = -1, bd = 1e9;
  const c = body.cell, sc = useNorm ? body.P.s : 1; const q = [p[0] * sc, p[1] * sc, p[2] * sc];
  for (let rr = 1; rr <= 6 && best < 0; rr++) {
    const cx = Math.floor(q[0] / c), cy = Math.floor(q[1] / c), cz = Math.floor(q[2] / c);
    for (let i = cx - rr; i <= cx + rr; i++) for (let j = cy - rr; j <= cy + rr; j++) for (let k = cz - rr; k <= cz + rr; k++) {
      const a = body.hash.get(((i + 512) * 1024 + (j + 512)) * 1024 + (k + 512)); if (!a) continue;
      for (const v of a) { const dx = arr[v * 3] - p[0], dy = arr[v * 3 + 1] - p[1], dz = arr[v * 3 + 2] - p[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < bd) { bd = d2; best = v; } }
    }
  }
  if (best < 0) { for (let v = 0; v < body.n; v++) { const dx = arr[v * 3] - p[0], dy = arr[v * 3 + 1] - p[1], dz = arr[v * 3 + 2] - p[2], d2 = dx * dx + dy * dy + dz * dz; if (d2 < bd) { bd = d2; best = v; } } }
  return best;
}

function installBody(body) {
  if (B) {
    scene.remove(B.skin, B.muscle); B.skin.geometry.dispose(); B.muscle.geometry.dispose();
    for (const gname in B.structures.groups) scene.remove(B.structures.groups[gname]);
  }
  B = body;
  scene.add(B.skin, B.muscle);
  for (const gname in B.structures.groups) scene.add(B.structures.groups[gname]);
  applyLayers(); recolorAll(); rebuildMarkVisuals();
  setTimeout(applyBVH, 60); // speed-up index for picking, built after the first frame is on screen
}

// ---------- colour composition ----------
function areaMarks() { return S.marks.filter(m => m.kind === 'area' && m.visible && S.layers.marks); }
function recolor(verts) {
  const AM = areaMarks().map(m => ({ w: m.w, c: hex(QMAP[m.type].color), sel: m.id === S.selId }));
  const base = S.skinMode === 'derm' ? B.dermBase : S.skinMode === 'muscles' ? B.musBase : B.skinBase, mb = B.musBase, col = B.col, mcol = B.mcol;
  const inner = innerOn(), alphaSkin = inner ? S.xray : 1, alphaMus = (S.layers.muscle && deepOn()) ? Math.min(1, S.xray * 2.2 + 0.15) : 1;
  const apply = v => {
    let r = base[v * 3], g = base[v * 3 + 1], b = base[v * 3 + 2];
    let mr = mb[v * 3], mg = mb[v * 3 + 1], mbb = mb[v * 3 + 2], pw = 0;
    if (B.hoverMus && B.musId[v] === B.hoverMus) { mr = Math.min(1, mr * 1.5 + 0.12); mg = Math.min(1, mg * 1.3 + 0.1); mbb = Math.min(1, mbb * 1.2 + 0.05); }
    for (const m of AM) { const w = m.w[v]; if (w > 0.01) { const t = Math.min(1, w) * 0.9; r = fmix(r, m.c[0], t); g = fmix(g, m.c[1], t); b = fmix(b, m.c[2], t); mr = fmix(mr, m.c[0], t); mg = fmix(mg, m.c[1], t); mbb = fmix(mbb, m.c[2], t); pw = Math.max(pw, t); } }
    col[v * 4] = r; col[v * 4 + 1] = g; col[v * 4 + 2] = b; col[v * 4 + 3] = Math.max(alphaSkin, pw * 0.92);
    mcol[v * 4] = mr; mcol[v * 4 + 1] = mg; mcol[v * 4 + 2] = mbb; mcol[v * 4 + 3] = Math.max(alphaMus, pw * 0.9);
  };
  if (verts) for (const v of verts) apply(v); else for (let v = 0; v < B.n; v++) apply(v);
  B.skin.geometry.attributes.color.needsUpdate = true; B.muscle.geometry.attributes.color.needsUpdate = true;
}
const recolorAll = () => recolor(null);
function innerOn() { return INNER.some(k => S.layers[k]); }
function deepOn() { return INNER.filter(k => k !== 'muscle').some(k => S.layers[k]); }
function applyLayers() {
  if (!B) return;
  const inner = innerOn();
  B.skin.visible = S.layers.skin;
  const sm = B.skin.material; sm.transparent = inner; sm.depthWrite = !inner; sm.needsUpdate = true;
  B.skin.renderOrder = 3;
  B.muscle.visible = false; // 3D atlas muscles replace the old surface shell (its colours remain as "Skin shows: muscle map")
  for (const k of INNER) B.structures.groups[k].visible = S.layers[k];
  // muscles become see-through when deeper layers are shown, so bones, nerves and organs stay visible
  const seeMus = S.layers.muscle && deepOn();
  for (const m of B.atlasMeshes) if (m.userData.layer === 'muscle') { m.material.transparent = seeMus; m.material.opacity = seeMus ? Math.min(0.85, S.xray * 2 + 0.2) : 1; m.material.depthWrite = !seeMus; m.renderOrder = seeMus ? 2 : 0; m.material.needsUpdate = true; }
  marksGroup.visible = S.layers.marks;
  recolorAll();
  $$('#layerList input[type=checkbox]').forEach(cb => cb.checked = !!S.layers[cb.dataset.layer]);
  $('#xrayRow').hidden = !inner;
}

// ---------- marks ----------
const getMark = id => S.marks.find(m => m.id === id);
function newMark(kind, type) {
  const q = QMAP[type]; const count = S.marks.filter(m => m.type === type && m.kind === kind).length + 1;
  const m = { id: S.nextId++, kind, type, name: q.label + ' — ' + (kind === 'area' ? 'area' : kind === 'line' ? 'spreading path' : 'point') + ' ' + count, visible: true, attrs: defAttrs(), w: kind === 'area' ? new Float32Array(B.n) : null, pts: kind === 'area' ? null : [] };
  if (kind === 'line') m.attrs.dir = 'out';
  S.marks.push(m); S.selId = m.id; return m;
}
function deleteMark(id, noUndo) {
  const i = S.marks.findIndex(m => m.id === id); if (i < 0) return;
  const [m] = S.marks.splice(i, 1);
  if (!noUndo) pushUndo({ t: 'del', mark: m, index: i });
  if (m.obj) { marksGroup.remove(m.obj); m.obj = null; }
  if (S.selId === id) S.selId = S.marks.length ? S.marks[S.marks.length - 1].id : null;
  if (m.kind === 'area') recolorAll();
  refreshUI();
}
function vpos(v, off = 0) { return new THREE.Vector3(B.pos[v * 3] + B.nor[v * 3] * off, B.pos[v * 3 + 1] + B.nor[v * 3 + 1] * off, B.pos[v * 3 + 2] + B.nor[v * 3 + 2] * off); }
function markVisual(m) {
  if (m.obj) { marksGroup.remove(m.obj); m.obj.traverse(o => o.geometry && o.geometry.dispose()); m.obj = null; }
  if (m.kind === 'area' || !m.pts.length) return;
  const color = new THREE.Color(QMAP[m.type].color), sel = m.id === S.selId;
  const mat = new THREE.MeshStandardMaterial({ color, roughness: 0.4, emissive: color.clone().multiplyScalar(0.25), depthTest: true });
  const grp = new THREE.Group();
  if (m.kind === 'point') {
    const v = m.pts[0], p = vpos(v, 0.004), nn = new THREE.Vector3(B.nor[v * 3], B.nor[v * 3 + 1], B.nor[v * 3 + 2]);
    const s = new THREE.Mesh(new THREE.SphereGeometry(sel ? 0.0065 : 0.0052, 14, 10), mat); s.position.copy(p); grp.add(s);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.012, 0.0016, 6, 28), mat); ring.position.copy(p); ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), nn); grp.add(ring);
  } else {
    const pts = m.pts.map(v => vpos(v, 0.004));
    if (pts.length >= 2) {
      const curve = new THREE.CatmullRomCurve3(pts, false, 'centripetal');
      grp.add(new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(8, pts.length * 3), sel ? 0.0034 : 0.0026, 6, false), mat));
      const cone = (at, dirT) => { const c = new THREE.Mesh(new THREE.ConeGeometry(sel ? 0.0085 : 0.007, 0.02, 12), mat); const P0 = curve.getPointAt(at), tg = curve.getTangentAt(at).multiplyScalar(dirT); c.position.copy(P0); c.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tg.normalize()); grp.add(c); };
      if (m.attrs.dir === 'out' || m.attrs.dir === 'both') cone(1, 1);
      if (m.attrs.dir === 'in' || m.attrs.dir === 'both') cone(0, -1);
      const st = new THREE.Mesh(new THREE.SphereGeometry(sel ? 0.0062 : 0.0048, 12, 8), new THREE.MeshStandardMaterial({ color: START_COL, roughness: 0.4 })); st.position.copy(pts[0]); grp.add(st);
      if (sel && stroke?.mark !== m) { // label both ends of the selected path
        const v0 = m.pts[0], v1 = m.pts[m.pts.length - 1], nv = v => new THREE.Vector3(B.nor[v * 3], B.nor[v * 3 + 1], B.nor[v * 3 + 2]);
        const a = startTag.clone(), b = endTag.clone(); a.material = startTag.material; b.material = endTag.material;
        placeTag(a, pts[0], nv(v0)); placeTag(b, pts[pts.length - 1], nv(v1)); a.userData.follow = { p: pts[0].clone(), n: nv(v0) }; b.userData.follow = { p: pts[pts.length - 1].clone(), n: nv(v1) };
        grp.add(a, b);
      }
    } else { const s = new THREE.Mesh(new THREE.SphereGeometry(0.004, 10, 8), mat); s.position.copy(pts[0]); grp.add(s); }
  }
  grp.visible = m.visible; m.obj = grp; marksGroup.add(grp);
}
function rebuildMarkVisuals() { S.marks.forEach(markVisual); }

// ---------- undo ----------
function pushUndo(e) { undoStack.push(e); if (undoStack.length > 40) undoStack.shift(); $('#undoBtn').disabled = false; }
function undo() {
  const e = undoStack.pop(); $('#undoBtn').disabled = !undoStack.length; if (!e) return;
  if (e.t === 'w') { for (const s of e.snaps) { const m = getMark(s.id); if (m) m.w.set(s.w); } recolorAll(); }
  else if (e.t === 'add') { deleteMark(e.id, true); }
  else if (e.t === 'del') { S.marks.splice(e.index, 0, e.mark); S.selId = e.mark.id; markVisual(e.mark); recolorAll(); }
  else if (e.t === 'erase') {
    for (const m of S.marks) if (!e.prevMarks.includes(m) && m.obj) { marksGroup.remove(m.obj); m.obj = null; }
    S.marks = e.prevMarks;
    for (const s of e.snaps) { const m = getMark(s.id); if (m) m.w.set(s.w); }
    for (const m of S.marks) if (e.prevPts.has(m.id)) m.pts = e.prevPts.get(m.id);
    if (!getMark(S.selId)) S.selId = S.marks.length ? S.marks[S.marks.length - 1].id : null;
    rebuildMarkVisuals(); recolorAll();
  }
  else if (e.t === 'pts') { const m = getMark(e.id); if (m) { m.pts = e.pts; markVisual(m); } }
  refreshUI(); save();
}

// ---------- picking ----------
const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
function setNDC(e) { const r = canvas.getBoundingClientRect(); ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1); ray.setFromCamera(ndc, camera); }
function pickSkin(e) {
  setNDC(e); ray.firstHitOnly = true;
  const hits = ray.intersectObject(B.skin, false); ray.firstHitOnly = false;
  if (!hits.length) return null;
  const h = hits[0], f = h.face; let best = f.a, bd = 1e9;
  for (const v of [f.a, f.b, f.c]) { const d = vpos(v).distanceToSquared(h.point); if (d < bd) { bd = d; best = v; } }
  const nn = new THREE.Vector3(B.nor[best * 3], B.nor[best * 3 + 1], B.nor[best * 3 + 2]);
  return { point: h.point, v: best, n: nn };
}
function pickHover(e) {
  setNDC(e);
  const targets = [];
  if (B.skin.visible) targets.push(B.skin);
  for (const k of INNER) if (B.structures.groups[k].visible) targets.push(...B.structures.groups[k].children);
  const hits = ray.intersectObjects(targets, false);
  if (!hits.length) return null;
  const solid = hits.find(h => !h.object.material.transparent);
  return solid || hits[0];
}
function hitVertex(h) { const f = h.face; let best = f.a, bd = 1e9; const pos = h.object.geometry.attributes.position; const tmp = new THREE.Vector3(); for (const v of [f.a, f.b, f.c]) { tmp.fromBufferAttribute(pos, v); const d = tmp.distanceToSquared(h.point); if (d < bd) { bd = d; best = v; } } return best; }

// ---------- painting ----------
let stroke = null; const activePointers = new Map();
function stampArea(hit, erase) {
  const r = S.brush, nn = hit.n, p = [hit.point.x, hit.point.y, hit.point.z];
  const touched = [];
  const targets = erase ? S.marks.filter(m => m.kind === 'area' && m.visible) : [stroke.mark];
  radiusQuery(p, r, (v, d) => {
    const ndot = B.nor[v * 3] * nn.x + B.nor[v * 3 + 1] * nn.y + B.nor[v * 3 + 2] * nn.z; if (ndot < 0.15) return;
    const x = 1 - d / r, f = x * x * (3 - 2 * x);
    for (const m of targets) { m.w[v] = erase ? Math.max(0, m.w[v] - f * 0.5) : Math.min(1, m.w[v] + f * 0.45); }
    touched.push(v);
  });
  recolor(touched);
  if (erase) eraseMarksAt(p, r);
}
// eraser also removes points and cuts paths under the brush (a path erased in the middle splits in two)
function removeMarkSilently(m) { const i = S.marks.indexOf(m); if (i >= 0) S.marks.splice(i, 1); if (m.obj) { marksGroup.remove(m.obj); m.obj = null; } if (S.selId === m.id) S.selId = null; }
function eraseMarksAt(p, r) {
  const r2 = r * r; let changed = false;
  for (const m of [...S.marks]) {
    if (m.kind === 'area' || !m.visible || !m.pts) continue;
    const hit = m.pts.map(v => { const dx = B.pos[v * 3] - p[0], dy = B.pos[v * 3 + 1] - p[1], dz = B.pos[v * 3 + 2] - p[2]; return dx * dx + dy * dy + dz * dz <= r2; });
    if (!hit.some(Boolean)) continue;
    changed = true;
    if (m.kind === 'point') { removeMarkSilently(m); continue; }
    const segs = []; let cur = [];
    m.pts.forEach((v, i) => { if (hit[i]) { if (cur.length) segs.push(cur); cur = []; } else cur.push(v); });
    if (cur.length) segs.push(cur);
    const keep = segs.filter(s => s.length >= 2);
    if (!keep.length) { removeMarkSilently(m); continue; }
    m.pts = keep[0]; markVisual(m);
    keep.slice(1).forEach((s, k) => {
      const c = { ...m, id: S.nextId++, name: m.name + ' (part ' + (k + 2) + ')', attrs: JSON.parse(JSON.stringify(m.attrs)), pts: s, obj: null };
      S.marks.splice(S.marks.indexOf(m) + 1 + k, 0, c); markVisual(c);
    });
  }
  return changed;
}
function strokeTo(hit) {
  const last = stroke.last; const step = Math.max(0.003, S.brush * 0.3);
  if (last) { const d = last.point.distanceTo(hit.point); const k = Math.min(30, Math.floor(d / step)); for (let i = 1; i <= k; i++) { const t = i / (k + 1); const P0 = last.point.clone().lerp(hit.point, t); const nn = last.n.clone().lerp(hit.n, t).normalize(); stampArea({ point: P0, n: nn }, stroke.erase); } }
  stampArea(hit, stroke.erase); stroke.last = hit;
}
function setTool(t) {
  S.tool = t;
  $$('#tools button').forEach(b => b.setAttribute('aria-pressed', b.dataset.tool === t));
  const paint = t !== 'explore';
  controls.mouseButtons = { LEFT: paint ? null : THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.PAN, RIGHT: paint ? THREE.MOUSE.ROTATE : THREE.MOUSE.PAN };
  controls.touches = { ONE: paint ? null : THREE.TOUCH.ROTATE, TWO: paint ? THREE.TOUCH.DOLLY_ROTATE : THREE.TOUCH.DOLLY_PAN };
  $('#brushRow').hidden = !(t === 'brush' || t === 'erase');
  $('#toolHint').textContent = {
    explore: 'Drag to rotate · scroll/pinch to zoom · right-drag to pan. Hover or tap anything to identify it; click to pin the description.',
    brush: 'Paint an area of pain. Right-drag (or two fingers) rotates. Painting on an existing mark of the same type adds to it.',
    line: 'Draw the path the pain travels. The green START tag shows where it will begin; while drawing, the red END tag follows you until you let go. An arrow shows the direction it spreads.',
    point: 'Tap a single exact spot (e.g. a tender point or trigger point).',
    erase: 'Erase anything under the brush: painted areas, points, and parts of paths (erasing the middle of a path splits it in two). Undo restores it. To remove a whole mark at once, use ✕ in "Your marks".',
  }[t];
  cursorRing.visible = false;
}
canvas.addEventListener('pointerdown', e => {
  activePointers.set(e.pointerId, e);
  if (!B) return;
  if (e.pointerType === 'touch' && activePointers.size > 1) { if (stroke) endStroke(); return; }
  if (S.tool === 'explore') { stroke = { explore: true, x: e.clientX, y: e.clientY }; return; }
  if (e.button !== 0) return;
  const hit = pickSkin(e); if (!hit) return;
  e.preventDefault(); canvas.setPointerCapture(e.pointerId);
  if (S.tool === 'brush' || S.tool === 'erase') {
    let mark = null; const sel = getMark(S.selId);
    if (S.tool === 'brush') { mark = sel && sel.kind === 'area' && sel.type === S.quality ? sel : newMarkWithUndo('area'); if (!mark.visible) mark.visible = true; }
    const snaps = (S.tool === 'erase' ? S.marks.filter(m => m.kind === 'area') : [mark]).map(m => ({ id: m.id, w: m.w.slice() }));
    stroke = { mark, erase: S.tool === 'erase', snaps, last: null };
    if (stroke.erase) { stroke.prevMarks = S.marks.slice(); stroke.prevPts = new Map(S.marks.filter(m => m.pts).map(m => [m.id, m.pts.slice()])); }
    strokeTo(hit);
  } else if (S.tool === 'line') {
    const mark = newMarkWithUndo('line'); mark.pts.push(hit.v); stroke = { mark, line: true, lastP: hit.point.clone(), startP: hit.point.clone(), startN: hit.n.clone() }; markVisual(mark); updateCursor(hit);
  } else if (S.tool === 'point') {
    const mark = newMarkWithUndo('point'); mark.pts.push(hit.v); markVisual(mark); refreshUI(); save(); stroke = null;
  }
});
function newMarkWithUndo(kind) { const m = newMark(kind, S.quality); pushUndo({ t: 'add', id: m.id }); return m; }
canvas.addEventListener('pointermove', e => {
  if (activePointers.has(e.pointerId)) activePointers.set(e.pointerId, e);
  if (!B) return;
  if (stroke && !stroke.explore) {
    const hit = pickSkin(e); if (!hit) return;
    if (stroke.line) { if (hit.point.distanceTo(stroke.lastP) > 0.008) { const m = stroke.mark; if (m.pts[m.pts.length - 1] !== hit.v) m.pts.push(hit.v); stroke.lastP = hit.point.clone(); markVisual(m); } }
    else strokeTo(hit);
    updateCursor(hit);
    return;
  }
  scheduleHover(e);
});
function endStroke() {
  if (!stroke) return;
  if (stroke.mark && stroke.snaps && !stroke.erase) { pushUndo({ t: 'w', snaps: stroke.snaps }); }
  if (stroke.erase) pushUndo({ t: 'erase', snaps: stroke.snaps, prevMarks: stroke.prevMarks, prevPts: stroke.prevPts });
  if (stroke.line && stroke.mark.pts.length < 2) { undoStack.pop(); deleteMark(stroke.mark.id, true); }
  const wasLine = stroke.line;
  stroke = null; hidePathTags(); if (wasLine) { cursorRing.visible = false; rebuildMarkVisuals(); } refreshUI(); save();
}
const upHandler = e => {
  activePointers.delete(e.pointerId);
  if (stroke && stroke.explore) {
    const moved = Math.hypot(e.clientX - stroke.x, e.clientY - stroke.y) > 5; stroke = null;
    if (!moved) { const h = pickHover(e); if (h) { inspectHit(h, true); } else { insp.locked = false; renderInspector(); } }
    return;
  }
  endStroke();
};
canvas.addEventListener('pointerup', upHandler); canvas.addEventListener('pointercancel', upHandler);
canvas.addEventListener('pointerleave', () => { $('#tip').hidden = true; cursorRing.visible = false; if (!stroke) hidePathTags(); if (!insp.locked) clearHoverHighlight(); });
canvas.addEventListener('contextmenu', e => e.preventDefault());

let hoverQ = null;
function scheduleHover(e) { if (hoverQ) { hoverQ = e; return; } hoverQ = e; requestAnimationFrame(() => { const ev = hoverQ; hoverQ = null; doHover(ev); }); }
function updateCursor(hit) {
  const ringAt = r => { cursorRing.visible = true; cursorRing.position.copy(hit.point).addScaledVector(hit.n, 0.002); cursorRing.scale.setScalar(r); cursorRing.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), hit.n); };
  if (S.tool === 'brush' || S.tool === 'erase') { ringAt(S.brush); cursorRing.material.color.set(S.tool === 'erase' ? 0x777777 : QMAP[S.quality].color); hidePathTags(); }
  else if (S.tool === 'line') {
    if (stroke && stroke.line) { // drawing: start fixed, END follows the pointer
      ringAt(0.012); cursorRing.material.color.set(END_COL); placeTag(endTag, hit.point, hit.n);
      placeRing(startRing, stroke.startP, stroke.startN, 0.012); placeTag(startTag, stroke.startP, stroke.startN);
    } else { // not yet drawing: show where the path will START
      ringAt(0.012); cursorRing.material.color.set(START_COL); placeTag(startTag, hit.point, hit.n); endTag.visible = false; startRing.visible = false;
    }
  }
  else if (S.tool === 'point') { ringAt(0.012); cursorRing.material.color.set(QMAP[S.quality].color); hidePathTags(); }
  else { cursorRing.visible = false; hidePathTags(); }
}
function doHover(e) {
  if (!B || e.pointerType === 'touch') return;
  if (S.tool !== 'explore') { const hit = pickSkin(e); if (hit) updateCursor(hit); else cursorRing.visible = false; }
  const h = pickHover(e); const tip = $('#tip');
  if (!h) { tip.hidden = true; return; }
  const name = inspectHit(h, false);
  tip.hidden = false; tip.textContent = name;
  const r = canvas.getBoundingClientRect(); const tx = e.clientX - r.left + 14, ty = e.clientY - r.top + 14;
  tip.style.left = Math.min(tx, r.width - 260) + 'px'; tip.style.top = Math.min(ty, r.height - 40) + 'px';
}

// ---------- inspector ----------
const insp = { locked: false, data: null, focus: null };
let hoverMeshes = [];
let hoverAtlas = null; // { mesh, range }
function clearHoverHighlight() {
  for (const m of hoverMeshes) m.material.emissive.setHex(m.userData.baseEmissive); hoverMeshes = [];
  if (hoverAtlas) { const { mesh, r } = hoverAtlas, c = mesh.geometry.attributes.color; c.array.set(mesh.userData.baseCol.subarray(r[0] * 3, r[1] * 3), r[0] * 3); c.needsUpdate = true; hoverAtlas = null; }
  if (B && B.hoverMus) { const vs = B.musVerts.get(B.hoverMus) || []; B.hoverMus = null; recolor(vs); }
}
const sideLabel = s => s === 'left' ? 'LEFT side (patient\'s left)' : s === 'right' ? 'RIGHT side (patient\'s right)' : 'Midline (centre)';
function inspectHit(h, lock) {
  if (insp.locked && !lock) return tipName(h);
  clearHoverHighlight();
  const obj = h.object;
  let data;
  if (obj.userData.atlas) {
    const pi = obj.userData.pid[h.face.a], part = B.atlasParts[pi], side = /\bleft\b/i.test(part.name) ? 'left' : /\bright\b/i.test(part.name) ? 'right' : 'midline';
    data = { kind: 'structure', id: part.id, side, atlasName: part.name };
    const r = obj.userData.ranges.get(pi), c = obj.geometry.attributes.color;
    for (let v = r[0]; v < r[1]; v++) { c.array[v * 3] = 1; c.array[v * 3 + 1] = 0.55; c.array[v * 3 + 2] = 0.2; }
    c.needsUpdate = true; hoverAtlas = { mesh: obj, r };
  } else if (obj.userData.id) {
    const id = obj.userData.id; const side = h.point.x > 0.006 ? 'left' : h.point.x < -0.006 ? 'right' : 'midline';
    data = { kind: 'structure', id, side };
    for (const m of B.structures.byId.get(id) || []) { m.material.emissive.setHex(0xff7a2f); hoverMeshes.push(m); }
  } else {
    const v = hitVertex(h); const R = B.cls(v);
    data = { kind: 'surface', v, R, shell: obj.userData.shell };
    if (obj.userData.shell === 'muscle' && B.musId[v]) { B.hoverMus = B.musId[v]; recolor(B.musVerts.get(B.hoverMus)); }
  }
  insp.data = data; insp.focus = null; if (lock) insp.locked = true;
  renderInspector();
  return tipName(h);
}
function tipName(h) {
  const obj = h.object;
  if (obj.userData.atlas) { const part = B.atlasParts[obj.userData.pid[h.face.a]]; return atlasTitle(part); }
  if (obj.userData.id) { const side = h.point.x > 0.006 ? 'L' : h.point.x < -0.006 ? 'R' : ''; return (side ? side + ' · ' : '') + label(obj.userData.id) + (['nerve', 'ligament', 'tendon', 'cartilage'].includes(obj.userData.layer) ? ' (schematic)' : ''); }
  const v = hitVertex(h), R = B.cls(v);
  if (obj.userData.shell === 'muscle' && R.m[0]) return (R.side === 'left' ? 'L · ' : R.side === 'right' ? 'R · ' : '') + label(R.m[0]);
  return (R.side === 'left' ? 'L · ' : R.side === 'right' ? 'R · ' : '') + R.zone;
}
// "Left extensor carpi radialis brevis" -> "Extensor carpi radialis brevis (L)"; atlas names are exact anatomical names
function atlasTitle(part) {
  const side = /\bleft\b/i.test(part.name) ? 'L' : /\bright\b/i.test(part.name) ? 'R' : '';
  const n = part.name.replace(/\b(left|right)\b ?/gi, '').replace(/ of (hand|foot)$/, ' ($1)').trim();
  return (side ? side + ' · ' : '') + n.charAt(0).toUpperCase() + n.slice(1);
}
function infoCard(id, side, atlasName) {
  const d = info(id);
  const exact = atlasName ? atlasName.replace(/\b(left|right)\b ?/gi, '').trim() : '';
  const showExact = exact && exact.toLowerCase() !== d.name.toLowerCase();
  return `<div class="card"><div class="card-h"><span class="lay lay-${d.layer}">${esc(LAYER_NAMES[d.layer] || d.layer)}</span>${side && side !== 'midline' ? `<span class="side">${side === 'left' ? 'Patient\'s LEFT' : 'Patient\'s RIGHT'}</span>` : ''}${atlasName ? '<span class="side">3D atlas</span>' : ['nerve', 'ligament', 'tendon', 'cartilage'].includes(d.layer) ? '<span class="side">schematic</span>' : ''}</div>
  ${showExact ? `<h3>${esc(exact.charAt(0).toUpperCase() + exact.slice(1))}</h3><p class="plain">part of: ${esc(d.name)}${d.plain ? ' (' + esc(d.plain) + ')' : ''}</p>` : `<h3>${esc(d.name)}</h3>${d.plain ? `<p class="plain">${esc(d.plain)}</p>` : ''}`}
  ${d.desc ? `<dl><dt>What it is</dt><dd>${esc(d.desc)}</dd>` : '<dl>'}${d.func && d.func !== '—' ? `<dt>What it does</dt><dd>${esc(d.func)}</dd>` : ''}${d.pain ? `<dt>Pain relevance</dt><dd>${esc(d.pain)}</dd>` : ''}</dl></div>`;
}
function chipRow(title, ids) { if (!ids.length) return ''; return `<div class="chips-t">${title}</div><div class="chips">${ids.map(id => `<button class="chip" data-focus="${esc(id)}">${esc(label(id))}</button>`).join('')}</div>`; }
function renderInspector() {
  const el = $('#inspBody'); const d = insp.data;
  $('#inspLock').hidden = !insp.locked;
  if (!d) { el.innerHTML = '<p class="muted">Point at (or tap) the body or any anatomy layer to see what is there: the name, what it does and why it can hurt.</p>'; return; }
  if (d.kind === 'structure') { el.innerHTML = infoCard(d.id, d.side, d.atlasName); return; }
  const R = d.R; const focus = insp.focus || (d.shell === 'muscle' ? R.m[0] : null) || R.m[0] || R.s[0] || R.b[0] || R.nv[0];
  const lv = B.lvl[d.v] >= 0 && R.asp && (R.asp.startsWith('posterior') || R.seg === 'neck') ? LEVELS[B.lvl[d.v]].name : '';
  const dr = R.derm ? (ROOTS[R.derm.match(/[CTLS]\d+/)?.[0]] || null) : null;
  el.innerHTML = `<div class="where"><div class="side-pill ${R.side}">${esc(sideLabel(R.side))}</div><h3>${esc(R.zone)}</h3>
   <p class="meta">${R.asp ? 'Surface: ' + esc(ASP[R.asp] || R.asp) + ' · ' : ''}${R.derm ? 'Dermatome (skin strip): <b>' + esc(R.derm) + '</b>' + (dr ? ' — ' + esc(dr[0]) : '') : ''}${lv ? ' · Spinal level ≈ ' + lv : ''}</p></div>
   ${chipRow('Muscles', R.m)}${chipRow('Tendons, ligaments, joints & regions', R.s)}${chipRow('Bones', R.b)}${chipRow('Nerves', R.nv)}
   ${R.visc.length ? `<div class="chips-t">Organs / vessels nearby</div><p class="visc">${esc(R.visc.join('; '))}</p>` : ''}
   ${focus ? infoCard(focus, R.side) : ''}`;
  el.querySelectorAll('[data-focus]').forEach(b => { if (b.dataset.focus === focus) b.classList.add('on'); b.onclick = () => { insp.focus = b.dataset.focus; insp.locked = true; renderInspector(); }; });
}
$('#inspLock').onclick = () => { insp.locked = false; renderInspector(); };

// ---------- camera presets ----------
let fly = null;
function flyTo(target, dir, dist) {
  const s = B ? B.P.s : 1; const t = new THREE.Vector3(...target).multiplyScalar(s);
  const d = new THREE.Vector3(...dir).normalize();
  fly = { t0: performance.now(), fromP: camera.position.clone(), fromT: controls.target.clone(), toT: t, toP: t.clone().addScaledVector(d, dist) };
}
function views() {
  const P = B ? B.P : makeParams('male'); const Lw = P.arm[0], Rw = P.arm[1], LL = P.leg[0], RL = P.leg[1];
  const hand = A => add(A.W, mul(A.d, 0.06));
  return {
    front: [[0, 0.9, 0], [0, 0.08, 1], 3.3], back: [[0, 0.9, 0], [0, 0.08, -1], 3.3], left: [[0, 0.9, 0], [1, 0.05, 0], 3.0], right: [[0, 0.9, 0], [-1, 0.05, 0], 3.0],
    top: [[0, 1.0, 0], [0, 1, 0.25], 2.8], below: [[0, 0.84, -0.01], [0, -1, 0.18], 0.75],
    face: [[0, 1.625, 0.03], [0.35, 0.05, 1], 0.5], head_side: [[0, 1.63, 0], [1, 0.05, 0.15], 0.55], neck_back: [[0, 1.45, -0.03], [0, 0.25, -1], 0.75],
    lhand: [hand(Lw), [0.1, 0.05, 1], 0.42], rhand: [hand(Rw), [-0.1, 0.05, 1], 0.42], lhand_back: [hand(Lw), [0.1, 0.05, -1], 0.42], rhand_back: [hand(Rw), [-0.1, 0.05, -1], 0.42],
    lfoot: [add(LL.A, [0, -0.03, 0.05]), [0.25, 0.7, 1], 0.5], rfoot: [add(RL.A, [0, -0.03, 0.05]), [-0.25, 0.7, 1], 0.5], soles: [[0, 0.04, 0.03], [0, -0.35, -1], 0.9],
    groin: [[0, 0.86, 0.04], [0, -0.3, 1], 0.6], perineum: [[0, 0.83, 0.0], [0, -1, 0.3], 0.5], buttocks: [[0, 0.88, -0.05], [0, -0.35, -1], 0.7],
    chest: [[0, 1.27, 0.06], [0, -0.35, 1], 0.75], back_low: [[0, 1.02, -0.06], [0, 0.1, -1], 0.85],
  };
}
function goView(k) {
  const v = views()[k]; if (!v) return;
  let dist = v[2];
  if (['front', 'back', 'left', 'right', 'top'].includes(k)) { // fit the whole body to the viewer's shape
    const th = Math.tan(camera.fov * deg / 2), wide = k === 'front' || k === 'back' || k === 'top' ? 1.0 : 0.45;
    dist = Math.max(1.12 / th, wide / (th * camera.aspect)) * (B ? B.P.s : 1);
  }
  flyTo(v[0], v[1], dist);
}
function orientLabel() {
  const dx = camera.position.x - controls.target.x, dz = camera.position.z - controls.target.z, dy = camera.position.y - controls.target.y;
  const az = Math.atan2(dx, dz) / deg, el = Math.atan2(dy, Math.hypot(dx, dz)) / deg;
  let s;
  if (el < -55) s = 'View from below — the patient\'s RIGHT is on your ' + (Math.abs(az) < 90 ? 'LEFT' : 'RIGHT');
  else if (el > 60) s = 'View from above';
  else if (Math.abs(az) <= 45) s = 'Front view (anterior) — the patient\'s RIGHT is on your LEFT';
  else if (Math.abs(az) >= 135) s = 'Back view (posterior) — the patient\'s RIGHT is on your RIGHT';
  else if (az > 0) s = 'Patient\'s LEFT side (left lateral view)';
  else s = 'Patient\'s RIGHT side (right lateral view)';
  const el2 = $('#orient'); if (el2.textContent !== s) el2.textContent = s;
}

// ---------- render loop ----------
function tick(t) {
  if (fly) { const k = Math.min(1, (t - fly.t0) / 550), e = 1 - Math.pow(1 - k, 3); camera.position.lerpVectors(fly.fromP, fly.toP, e); controls.target.lerpVectors(fly.fromT, fly.toT, e); if (k >= 1) fly = null; }
  controls.update(); orientLabel();
  marksGroup.traverse(o => { if (o.userData.follow) placeTag(o, o.userData.follow.p, o.userData.follow.n); }); // keep end labels readable when zooming
  renderer.render(scene, camera); requestAnimationFrame(tick);
}
requestAnimationFrame(tick);

// ---------- UI ----------
function buildStaticUI() {
  $('#qualList').innerHTML = QUAL.map(q => `<button class="qual" data-q="${q.k}" aria-pressed="${q.k === S.quality}"><i style="background:${q.color}"></i>${esc(q.label)}</button>`).join('');
  $$('#qualList .qual').forEach(b => b.onclick = () => { S.quality = b.dataset.q; $$('#qualList .qual').forEach(x => x.setAttribute('aria-pressed', x === b)); const m = getMark(S.selId); if (m && S.tool === 'explore') { } });
  $('#layerList').innerHTML = LAYERS.map(([k, l, c]) => `<label class="layer"><input type="checkbox" data-layer="${k}" ${S.layers[k] ? 'checked' : ''}><i style="background:${c}"></i><span>${esc(l)}</span></label>`).join('');
  $$('#layerList input').forEach(cb => cb.onchange = () => { S.layers[cb.dataset.layer] = cb.checked; applyLayers(); save(); });
  $$('#tools button').forEach(b => b.onclick = () => setTool(b.dataset.tool));
  $('#brushSize').oninput = e => { S.brush = parseFloat(e.target.value) / 100; $('#brushVal').textContent = e.target.value + ' cm'; };
  $('#xray').oninput = e => { S.xray = parseFloat(e.target.value) / 100; applyLayers(); };
  $('#skinMode').onchange = e => { S.skinMode = e.target.value; recolorAll(); $('#dermLegend').hidden = S.skinMode !== 'derm'; save(); };
  $$('[data-preset]').forEach(b => b.onclick = () => {
    const p = b.dataset.preset; const L = S.layers; for (const k of Object.keys(L)) if (k !== 'marks') L[k] = false;
    ({ skin: () => { L.skin = true; }, muscles: () => { L.muscle = true; }, skeleton: () => { L.bone = true; L.cartilage = true; L.skin = true; }, nerves: () => { L.nerve = true; L.bone = true; L.skin = true; }, joints: () => { L.bone = true; L.ligament = true; L.tendon = true; L.cartilage = true; L.skin = true; }, all: () => { for (const k of Object.keys(L)) L[k] = true; } })[p]();
    applyLayers(); save();
  });
  $$('[data-view]').forEach(b => b.onclick = () => goView(b.dataset.view));
  $$('#sexSeg button').forEach(b => b.onclick = () => switchSex(b.dataset.sex));
  $('#undoBtn').onclick = undo;
  $('#clearBtn').onclick = () => openModal('clear');
  $('#saveBtn').onclick = () => openModal('save');
  $('#imgBtn').onclick = () => openModal('img');
  $('#exClear').onclick = () => { clearAll(); };
  $$('.tabs button').forEach(b => b.onclick = () => showTab(b.dataset.tab));
  // patient form
  const P = S.patient;
  $('#flagList').innerHTML = RED_FLAGS.map((f, i) => `<label class="chk"><input type="checkbox" data-flag="${i}"><span>${esc(f)}</span></label>`).join('');
  $$('#tab-about [data-p]').forEach(inp => { inp.oninput = inp.onchange = () => { P[inp.dataset.p] = inp.type === 'checkbox' ? inp.checked : inp.value; save(); }; });
  $$('#flagList input').forEach(cb => cb.onchange = () => { const f = RED_FLAGS[cb.dataset.flag]; P.flags = cb.checked ? [...new Set([...P.flags, f])] : P.flags.filter(x => x !== f); save(); });
  $('#purpose').onchange = e => { S.purpose = e.target.value; genPrompt(); save(); };
  $('#genBtn').onclick = genPrompt;
  $('#copyBtn').onclick = () => copyText($('#promptOut'), $('#copyBtn'));
  $('#incAnat').onchange = genPrompt;
}
function fillPatientForm() {
  const P = S.patient;
  $$('#tab-about [data-p]').forEach(inp => { if (inp.type === 'checkbox') inp.checked = !!P[inp.dataset.p]; else inp.value = P[inp.dataset.p] ?? ''; });
  $$('#flagList input').forEach(cb => cb.checked = P.flags.includes(RED_FLAGS[cb.dataset.flag]));
  $('#purpose').value = S.purpose;
}
function showTab(t) { $$('.tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t)); $$('.tabpane').forEach(p => p.hidden = p.id !== 'tab-' + t); if (t === 'prompt') genPrompt(); }
function copyText(ta, btn) {
  const done = ok => { const o = btn.textContent; btn.textContent = ok ? 'Copied' : 'Select & copy manually'; setTimeout(() => btn.textContent = o, 1600); };
  try { navigator.clipboard.writeText(ta.value).then(() => done(true), () => { ta.select(); done(false); }); } catch (e) { ta.select(); done(false); }
}
function refreshUI() {
  // marks list
  const L = $('#markList');
  if (!S.marks.length) L.innerHTML = '<p class="muted">No marks yet. Pick a pain type and a tool, then paint, draw or tap on the body.</p>';
  else L.innerHTML = S.marks.map(m => `<div class="mrow ${m.id === S.selId ? 'sel' : ''}" data-id="${m.id}"><i style="background:${QMAP[m.type].color}"></i><button class="mname" data-sel="${m.id}">${esc(m.name)}<small>${markSummary(m)}</small></button><button class="ico" data-vis="${m.id}" title="${m.visible ? 'Hide' : 'Show'}" aria-label="${m.visible ? 'Hide' : 'Show'} mark">${m.visible ? '◉' : '○'}</button><button class="ico" data-del="${m.id}" title="Delete" aria-label="Delete mark">✕</button></div>`).join('');
  L.querySelectorAll('[data-sel]').forEach(b => b.onclick = () => { S.selId = +b.dataset.sel; const m = getMark(S.selId); S.quality = m.type; $$('#qualList .qual').forEach(x => x.setAttribute('aria-pressed', x.dataset.q === m.type)); rebuildMarkVisuals(); refreshUI(); showTab('mark'); });
  L.querySelectorAll('[data-vis]').forEach(b => b.onclick = () => { const m = getMark(+b.dataset.vis); m.visible = !m.visible; if (m.obj) m.obj.visible = m.visible; if (m.kind === 'area') recolorAll(); refreshUI(); save(); });
  L.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { deleteMark(+b.dataset.del); save(); });
  $('#exBanner').hidden = !S.example;
  renderMarkEditor();
  if (!$('#tab-prompt').hidden) genPrompt();
}
function markSummary(m) {
  const a = analyzeMark(m); if (!a) return 'empty';
  if (m.kind === 'area') return esc(`${a.sideShort} · ${a.zones[0]?.zone || ''} · ${Math.round(a.areaCm2)} cm²`);
  if (m.kind === 'line') return esc(`${a.startSide} ${a.start.zone} → ${a.end.zone}`);
  return esc(`${a.sideShort} · ${a.R.zone}`);
}
function chipsHTML(list, sel, key) { return `<div class="chips sel">${list.map(o => `<button class="chip" data-${key}="${esc(o)}" aria-pressed="${sel.includes(o)}">${esc(o)}</button>`).join('')}</div>`; }
function renderMarkEditor() {
  const el = $('#tab-mark'); const m = getMark(S.selId);
  if (!m) { el.innerHTML = '<p class="muted pad">Select a mark from the list (or make one) to describe it.</p>'; return; }
  const a = m.attrs, q = QMAP[m.type];
  el.innerHTML = `<div class="pad">
   <label class="fl">Name<input id="mName" value="${esc(m.name)}"></label>
   <label class="fl">Pain type<select id="mType">${QUAL.map(x => `<option value="${x.k}" ${x.k === m.type ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</select></label>
   ${m.kind === 'line' ? `<label class="fl">How it spreads<select id="mDir"><option value="out" ${a.dir === 'out' ? 'selected' : ''}>Starts at the first point and travels to the end (arrow at end)</option><option value="in" ${a.dir === 'in' ? 'selected' : ''}>Travels from the end back to the start</option><option value="both" ${a.dir === 'both' ? 'selected' : ''}>Both directions</option><option value="static" ${a.dir === 'static' ? 'selected' : ''}>A band / strip that is all painful at once</option></select></label>` : ''}
   <div class="two"><label class="fl">Intensity now <b id="iVal">${a.intensity}/10</b><input type="range" min="0" max="10" id="mInt" value="${a.intensity}"></label>
   <label class="fl">At its worst <b id="wVal">${a.worst}/10</b><input type="range" min="0" max="10" id="mWorst" value="${a.worst}"></label></div>
   <label class="fl">How deep does it feel?<select id="mDepth">${DEPTH.map(([k, l]) => `<option value="${k}" ${k === a.depth ? 'selected' : ''}>${l}</option>`).join('')}</select></label>
   <div class="fl">When is it there?${chipsHTML(TIMING, a.timing, 'tm')}</div>
   <div class="two"><label class="fl">How did it start?<select id="mOnset">${ONSET.map(o => `<option ${o === a.onset ? 'selected' : ''} value="${esc(o)}">${o || '—'}</option>`).join('')}</select></label>
   <label class="fl">How long have you had it?<input id="mDur" placeholder="e.g. 3 weeks" value="${esc(a.duration)}"></label></div>
   <div class="fl">Makes it worse${chipsHTML(AGGR, a.aggr, 'ag')}</div>
   <div class="fl">Makes it better${chipsHTML(RELIEF, a.relief, 'rl')}</div>
   ${m.kind === 'point' ? `<label class="chk"><input type="checkbox" id="mRepro" ${a.pressRepro ? 'checked' : ''}><span>Pressing here reproduces my usual pain</span></label><label class="chk"><input type="checkbox" id="mRefer" ${a.pressRefers ? 'checked' : ''}><span>Pressing here sends pain somewhere else</span></label>` : ''}
   <label class="fl">Notes in your own words<textarea id="mNotes" rows="3" placeholder="e.g. feels like a hot wire, worse after driving">${esc(a.notes)}</textarea></label>
   <div class="anat"><h4>What this mark covers</h4>${anatomyBlurbHTML(m)}</div>
   <div class="row"><button id="mDel" class="danger">Delete mark</button></div></div>`;
  const upd = () => { save(); const r = $('#markList .mrow.sel small'); if (r) r.innerHTML = markSummary(m); };
  $('#mName').oninput = e => { m.name = e.target.value; const b = $(`[data-sel="${m.id}"]`); if (b) b.firstChild.textContent = m.name; upd(); };
  $('#mType').onchange = e => { m.type = e.target.value; S.quality = m.type; $$('#qualList .qual').forEach(x => x.setAttribute('aria-pressed', x.dataset.q === m.type)); markVisual(m); recolorAll(); refreshUI(); save(); };
  if ($('#mDir')) $('#mDir').onchange = e => { a.dir = e.target.value; markVisual(m); upd(); };
  $('#mInt').oninput = e => { a.intensity = +e.target.value; $('#iVal').textContent = a.intensity + '/10'; upd(); };
  $('#mWorst').oninput = e => { a.worst = +e.target.value; $('#wVal').textContent = a.worst + '/10'; upd(); };
  $('#mDepth').onchange = e => { a.depth = e.target.value; upd(); };
  $('#mOnset').onchange = e => { a.onset = e.target.value; upd(); };
  $('#mDur').oninput = e => { a.duration = e.target.value; upd(); };
  $('#mNotes').oninput = e => { a.notes = e.target.value; upd(); };
  if ($('#mRepro')) { $('#mRepro').onchange = e => { a.pressRepro = e.target.checked; upd(); }; $('#mRefer').onchange = e => { a.pressRefers = e.target.checked; upd(); }; }
  const tog = (arr, v) => { const i = arr.indexOf(v); if (i >= 0) arr.splice(i, 1); else arr.push(v); };
  el.querySelectorAll('[data-tm]').forEach(b => b.onclick = () => { tog(a.timing, b.dataset.tm); b.setAttribute('aria-pressed', a.timing.includes(b.dataset.tm)); upd(); });
  el.querySelectorAll('[data-ag]').forEach(b => b.onclick = () => { tog(a.aggr, b.dataset.ag); b.setAttribute('aria-pressed', a.aggr.includes(b.dataset.ag)); upd(); });
  el.querySelectorAll('[data-rl]').forEach(b => b.onclick = () => { tog(a.relief, b.dataset.rl); b.setAttribute('aria-pressed', a.relief.includes(b.dataset.rl)); upd(); });
  el.querySelectorAll('[data-focus]').forEach(b => b.onclick = () => { insp.data = { kind: 'structure', id: b.dataset.focus, side: '' }; insp.locked = true; renderInspector(); $('#inspector').scrollIntoView({ block: 'nearest' }); });
  $('#mDel').onclick = () => { deleteMark(m.id); save(); };
}

// ---------- sex switching & remap ----------
function switchSex(sex, force, after) {
  if (sex === S.sex && B && !force) return;
  $$('#sexSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sex === sex));
  if (!bodyCache[sex]) setLoading('Loading the ' + sex + ' model…');
  loadBody(sex).then(nb => {
    const old = B;
    if (old) {
      for (const m of S.marks) {
        if (m.kind === 'area') { const w = new Float32Array(nb.n); for (let v = 0; v < nb.n; v++) { const ov = nearestVertex(old, [nb.npos[v * 3], nb.npos[v * 3 + 1], nb.npos[v * 3 + 2]], true); w[v] = m.w[ov]; } m.w = w; }
        else m.pts = m.pts.map(v => nearestVertex(nb, [old.npos[v * 3], old.npos[v * 3 + 1], old.npos[v * 3 + 2]], true));
      }
      undoStack.length = 0; $('#undoBtn').disabled = true;
    }
    S.sex = sex; installBody(nb); setLoading(null); refreshUI(); if (after) after(); save();
  }).catch(err => setLoading(err.message));
}

// ---------- persistence ----------
let saveT = null;
function serialize() {
  return {
    v: 1, sex: S.sex, n: B ? B.n : 0, purpose: S.purpose, patient: S.patient, layers: S.layers, skinMode: S.skinMode, example: S.example,
    marks: S.marks.map(m => ({ id: m.id, kind: m.kind, type: m.type, name: m.name, visible: m.visible, attrs: m.attrs, pts: m.pts, pp: m.pts ? m.pts.map(npKey) : null, w: m.w ? sparse(m.w) : null, wp: m.w ? sparsePos(m.w) : null })),
  };
}
// positions are stored in millimetres (normalized body space) so maps survive model changes
const npKey = v => [Math.round(B.npos[v * 3] * 1000), Math.round(B.npos[v * 3 + 1] * 1000), Math.round(B.npos[v * 3 + 2] * 1000)];
function sparse(w) { const o = []; for (let i = 0; i < w.length; i++) if (w[i] > 0.02) o.push(i, Math.round(w[i] * 100)); return o; }
function sparsePos(w) { const o = []; for (let i = 0; i < w.length; i++) if (w[i] > 0.02) o.push(...npKey(i), Math.round(w[i] * 100)); return o; }
function save() { clearTimeout(saveT); saveT = setTimeout(() => { try { localStorage.setItem('painmap3d.v1', JSON.stringify(serialize())); } catch (e) { } }, 400); }
function loadState(o) {
  if (!o || o.v !== 1) return false;
  S.purpose = o.purpose || S.purpose; Object.assign(S.patient, o.patient || {}); if (o.layers) Object.assign(S.layers, o.layers); S.skinMode = o.skinMode || 'skin'; S.example = !!o.example;
  S.marks = []; S.nextId = 1;
  const exact = o.n === B.n && (o.sex || 'male') === S.sex;
  const fromMM = a => nearestVertex(B, [a[0] / 1000, a[1] / 1000, a[2] / 1000], true);
  for (const m of o.marks || []) {
    let pts = null;
    if (m.kind !== 'area') pts = exact && m.pts ? m.pts.filter(v => v < B.n) : (m.pp ? m.pp.map(fromMM) : []);
    if (m.kind !== 'area' && !pts.length) continue;
    const mk = { id: m.id, kind: m.kind, type: QMAP[m.type] ? m.type : 'aching', name: m.name, visible: m.visible !== false, attrs: Object.assign(defAttrs(), m.attrs), pts, w: null };
    if (m.kind === 'area') {
      mk.w = new Float32Array(B.n);
      if (exact && m.w) { const s = m.w; for (let i = 0; i < s.length; i += 2) mk.w[s[i]] = s[i + 1] / 100; }
      else if (m.wp) { const s = m.wp; for (let i = 0; i < s.length; i += 4) { const v = fromMM(s.slice(i, i + 3)); const val = s[i + 3] / 100; radiusQuery([B.pos[v * 3], B.pos[v * 3 + 1], B.pos[v * 3 + 2]], 0.006, u => { if (mk.w[u] < val) mk.w[u] = val; }); } }
      else continue;
    }
    S.marks.push(mk); S.nextId = Math.max(S.nextId, mk.id + 1);
  }
  S.selId = S.marks.length ? S.marks[0].id : null;
  $('#skinMode').value = S.skinMode; $('#dermLegend').hidden = S.skinMode !== 'derm';
  applyLayers(); rebuildMarkVisuals(); recolorAll(); fillPatientForm(); refreshUI();
  return true;
}
function clearAll() {
  for (const m of S.marks) if (m.obj) marksGroup.remove(m.obj);
  S.marks = []; S.selId = null; S.example = false; undoStack.length = 0; $('#undoBtn').disabled = true;
  recolorAll(); refreshUI(); save();
}

// ---------- modal ----------
function openModal(kind) {
  const md = $('#modal'), body = $('#modalBody'); md.hidden = false;
  if (kind === 'clear') {
    body.innerHTML = `<h3>Clear all marks?</h3><p>This removes every area, path and point on the body. Your "About you" details are kept.</p><div class="row"><button id="mdYes" class="danger">Clear marks</button><button id="mdNo">Cancel</button></div>`;
    $('#mdYes').onclick = () => { clearAll(); md.hidden = true; }; $('#mdNo').onclick = () => md.hidden = true;
  } else if (kind === 'save') {
    const json = JSON.stringify(serialize());
    body.innerHTML = `<h3>Save or load a pain map</h3><p class="muted">Your map is also kept automatically in this browser. To move it to another device, copy this text and keep it somewhere safe (it contains your health details).</p>
    <textarea id="saveTa" rows="6" readonly>${esc(json)}</textarea><div class="row"><button id="saveCopy" class="primary">Copy saved map</button></div>
    <h4>Load a map</h4><p class="muted">Paste saved text below or choose a saved .json file.</p><textarea id="loadTa" rows="4" placeholder="Paste saved map here"></textarea>
    <div class="row"><input type="file" id="loadFile" accept=".json,.txt,application/json"><button id="loadBtn">Load</button><button id="mdClose">Close</button></div><p id="loadMsg" class="muted"></p>`;
    $('#saveCopy').onclick = () => copyText($('#saveTa'), $('#saveCopy'));
    $('#loadFile').onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = () => { $('#loadTa').value = r.result; }; r.readAsText(f); };
    $('#loadBtn').onclick = () => {
      try { const o = JSON.parse($('#loadTa').value); const go = () => { loadState(o); $('#loadMsg').textContent = 'Loaded.'; save(); }; if (o.sex && o.sex !== S.sex) { S.marks = []; switchSex(o.sex, true, go); } else go(); }
      catch (e) { $('#loadMsg').textContent = 'That text is not a saved pain map. Copy the whole saved text and try again.'; }
    };
    $('#mdClose').onclick = () => md.hidden = true;
  } else if (kind === 'img') {
    body.innerHTML = `<h3>Body map images</h3><p class="muted">Front and back views with your marks. Right-click (or long-press on a phone) the image to save or share it with your clinician.</p><img id="exImg" alt="Front and back body map"><div class="row"><button id="mdClose">Close</button></div>`;
    $('#exImg').src = exportImage(); $('#mdClose').onclick = () => md.hidden = true;
  }
}
$('#modal').addEventListener('click', e => { if (e.target.id === 'modal') e.target.hidden = true; });
function exportImage() {
  const W = 700, H = 1000; const out = document.createElement('canvas'); out.width = W * 2; out.height = H + 60; const g = out.getContext('2d');
  g.fillStyle = '#f4f6f7'; g.fillRect(0, 0, out.width, out.height);
  const saved = { p: camera.position.clone(), t: controls.target.clone(), a: camera.aspect }; const size = new THREE.Vector2(); renderer.getSize(size);
  const pr = renderer.getPixelRatio(); renderer.setPixelRatio(1); renderer.setSize(W, H, false); camera.aspect = W / H; camera.updateProjectionMatrix();
  cursorRing.visible = false;
  const shots = [['FRONT — patient\'s RIGHT is on the left', [0, 0, 1]], ['BACK — patient\'s RIGHT is on the right', [0, 0, -1]]];
  shots.forEach(([lab, dir], i) => {
    const t = new THREE.Vector3(0, 0.89 * B.P.s, 0); camera.position.copy(t).add(new THREE.Vector3(...dir).multiplyScalar(3.35)); controls.target.copy(t); camera.lookAt(t);
    renderer.render(scene, camera); g.drawImage(renderer.domElement, i * W, 50, W, H);
    g.fillStyle = '#17212b'; g.font = '600 22px IBM Plex Sans, system-ui, sans-serif'; g.fillText(lab, i * W + 20, 34);
  });
  renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = saved.a; camera.updateProjectionMatrix(); camera.position.copy(saved.p); controls.target.copy(saved.t);
  return out.toDataURL('image/png');
}

// ---------- example ----------
function loadExample() {
  S.example = true;
  const s = B.P.s; const at = p => nearestVertex(B, p.map(c => c * s), false);
  const paintAt = (mark, centers, r) => { for (const c of centers) { const v = at(c); const p = [B.pos[v * 3], B.pos[v * 3 + 1], B.pos[v * 3 + 2]]; const nn = new THREE.Vector3(B.nor[v * 3], B.nor[v * 3 + 1], B.nor[v * 3 + 2]); radiusQuery(p, r, (u, d) => { const nd = B.nor[u * 3] * nn.x + B.nor[u * 3 + 1] * nn.y + B.nor[u * 3 + 2] * nn.z; if (nd < 0.2) return; const x = 1 - d / r; mark.w[u] = Math.min(1, mark.w[u] + x * x * (3 - 2 * x) * 0.9); }); } };
  const a = newMark('area', 'aching'); a.name = 'Low back ache (right)';
  paintAt(a, [[-0.045, 1.04, -0.12], [-0.05, 1.0, -0.12], [-0.035, 1.07, -0.12]], 0.045);
  Object.assign(a.attrs, { intensity: 5, worst: 8, depth: 'muscle', timing: ['Constant', 'Worse in the morning'], onset: 'After a specific activity', duration: '5 weeks', aggr: ['Bending forward', 'Sitting', 'Getting up from a chair'], relief: ['Heat', 'Moving around'], notes: 'Started after moving furniture.' });
  const l = newMark('line', 'shooting'); l.name = 'Shooting pain down the right leg';
  const R = B.P.leg[1]; const path = [[-0.07, 0.93, -0.16], [-0.09, 0.85, -0.16], R.th(0.35, 0, -0.12), R.th(0.6, 0, -0.1), R.th(0.85, 0, -0.09), add(R.K, [0, -0.01, -0.08]), R.sh(0.3, 0.02, -0.1), R.sh(0.6, 0.03, -0.08), R.sh(0.85, 0.035, -0.06), add(R.A, [-0.04, -0.03, -0.03]), R.ft(0.06, 0.02, 0.05)];
  const dense = []; for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < 6; k++) dense.push(lerp3(path[i], path[i + 1], k / 6)); dense.push(path[path.length - 1]);
  for (const p of dense) { const v = at(p); if (l.pts[l.pts.length - 1] !== v) l.pts.push(v); }
  Object.assign(l.attrs, { intensity: 6, worst: 9, depth: 'deep', timing: ['Comes and goes'], aggr: ['Sitting', 'Coughing / sneezing', 'Bending forward'], relief: ['Lying down'], dir: 'out', duration: '3 weeks', onset: 'Gradual', notes: 'Electric jolts, sometimes with tingling on the outer edge of the foot.' });
  const t = newMark('area', 'tingling'); t.name = 'Tingling outer right foot';
  paintAt(t, [R.ft(0.05, 0.03, 0.03), R.ft(0.05, 0.03, 0.09)], 0.028);
  Object.assign(t.attrs, { intensity: 3, worst: 5, depth: 'surface', timing: ['Comes and goes'], aggr: ['Sitting'], duration: '2 weeks', onset: 'Gradual' });
  const pt = newMark('point', 'tender'); pt.name = 'Tender spot in right buttock';
  pt.pts.push(at([-0.1, 0.89, -0.15])); Object.assign(pt.attrs, { intensity: 6, worst: 7, depth: 'muscle', pressRepro: true, pressRefers: true, aggr: ['Pressing on it', 'Sitting'] });
  Object.assign(S.patient, { age: '42', occupation: 'Office worker, sits 8+ hours a day', activity: 'Walks most days; plays recreational football at weekends', hand: 'Right', story: 'Back pain began after moving furniture; leg symptoms appeared about two weeks later.', tried: 'Ibuprofen helps a little; heat pack in the evening.', goals: 'Return to football and sit through a work day without leg pain.', noFlags: true });
  S.selId = l.id; rebuildMarkVisuals(); recolorAll(); fillPatientForm(); refreshUI(); save();
}

// ---------- boot ----------
buildStaticUI(); setTool('brush');
setLoading('Loading the 3D body…');
(async () => {
  const t0 = performance.now();
  let saved = null; try { saved = JSON.parse(localStorage.getItem('painmap3d.v1') || 'null'); } catch (e) { }
  const sex = saved && saved.sex === 'female' ? 'female' : 'male'; S.sex = sex;
  $$('#sexSeg button').forEach(b => b.setAttribute('aria-pressed', b.dataset.sex === sex));
  let body; try { body = await loadBody(sex); } catch (err) { setLoading(err.message); return; }
  installBody(body); setLoading(null); resize();
  if (!(saved && loadState(saved) && (saved.marks || []).length)) { if (!saved) loadExample(); else { fillPatientForm(); refreshUI(); } }
  goView('front'); renderInspector();
  window.__pm = { S, get B() { return B; }, info, genPrompt, loadMs: Math.round(performance.now() - t0), test: { stampArea, undo, startTag, endTag, startRing, tapAt: (k, fx, fy) => { // debug: tap at a fraction of a 560x760 view (works while the page is hidden)
    const v = views()[k], s = B.P.s, t = new THREE.Vector3(...v[0]).multiplyScalar(s), d = new THREE.Vector3(...v[1]).normalize();
    const cam = camera.clone(); cam.aspect = 560 / 760; cam.updateProjectionMatrix(); cam.position.copy(t).addScaledVector(d, ['front', 'back', 'left', 'right'].includes(k) ? 3.6 * s : v[2]); cam.lookAt(t); cam.updateMatrixWorld();
    const origSet = ray.setFromCamera.bind(ray); ray.setFromCamera = () => origSet(new THREE.Vector2(fx * 2 - 1, -(fy * 2 - 1)), cam);
    const h = pickHover({ clientX: 0, clientY: 0 }); ray.setFromCamera = origSet; if (!h) return null;
    const name = inspectHit(h, true); return { name, panel: $('#inspBody').innerText.slice(0, 500) };
  }, snap: (k, w = 560, h = 760) => { // debug: render a preset view to a JPEG data URL (works while the page is hidden)
    const v = views()[k]; const s = B.P.s; const t = new THREE.Vector3(...v[0]).multiplyScalar(s); const d = new THREE.Vector3(...v[1]).normalize();
    let dist = v[2]; if (['front', 'back', 'left', 'right'].includes(k)) dist = 3.6 * s;
    const pr = renderer.getPixelRatio(), size = new THREE.Vector2(); renderer.getSize(size); const sp = camera.position.clone(), st = controls.target.clone(), sa = camera.aspect;
    renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); camera.position.copy(t).addScaledVector(d, dist); camera.lookAt(t);
    renderer.setClearColor(0x2a3640, 1); renderer.render(scene, camera); const url = renderer.domElement.toDataURL('image/jpeg', 0.82); renderer.setClearColor(0x000000, 0);
    renderer.setPixelRatio(pr); renderer.setSize(size.x, size.y, false); camera.aspect = sa; camera.updateProjectionMatrix(); camera.position.copy(sp); controls.target.copy(st); return url;
  }, startErase: () => { stroke = { erase: true, snaps: S.marks.filter(m => m.kind === 'area').map(m => ({ id: m.id, w: m.w.slice() })), prevMarks: S.marks.slice(), prevPts: new Map(S.marks.filter(m => m.pts).map(m => [m.id, m.pts.slice()])) }; }, endStroke } };
  // fetch the other model in the background so switching is instant
  const other = sex === 'male' ? 'female' : 'male';
  setTimeout(() => { if (!bodyCache[other]) fetchBodyBytes(other).then(buf => { bodyCache[other] = bodyCache[other] || parseBody(buf); }).catch(() => { }); }, 1500);
})();
