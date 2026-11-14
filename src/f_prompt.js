// ===================== analysis & prompt =====================
const LUMBO = /lower back|sacr|buttock|gluteal|sit bone|tailbone|piriformis|natal cleft/;
function tallyAdd(o, k, a) { if (!k) return; o[k] = (o[k] || 0) + a; }
function ranked(o, min = 0) { const tot = Object.values(o).reduce((s, x) => s + x, 0) || 1; return Object.entries(o).map(([k, v]) => ({ k, f: v / tot })).sort((a, b) => b.f - a.f).filter(x => x.f >= min); }
const pct = f => Math.round(f * 100) + '%';
const joinList = a => a.length <= 1 ? (a[0] || '') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1];
const cap = s => s ? s[0].toUpperCase() + s.slice(1) : s;
const SIDEW = { left: 'LEFT (patient\'s left)', right: 'RIGHT (patient\'s right)', midline: 'midline (centre)' };
function sideText(sides) {
  const L = sides.find(s => s.k === 'left')?.f || 0, Rr = sides.find(s => s.k === 'right')?.f || 0, M = sides.find(s => s.k === 'midline')?.f || 0;
  if (L > 0.15 && Rr > 0.15) return { long: `both sides (bilateral — about ${pct(L)} left, ${pct(Rr)} right)`, short: 'Both sides' };
  if (M > 0.5) return { long: 'midline (centre of the body)', short: 'Midline' };
  if (L >= Rr) return { long: SIDEW.left, short: 'Left' };
  return { long: SIDEW.right, short: 'Right' };
}
function sizeWord(cm2) {
  if (cm2 < 5) return 'a small spot about the size of a fingertip';
  if (cm2 < 12) return 'about the size of a coin';
  if (cm2 < 30) return 'about the size of a large coin or bottle cap';
  if (cm2 < 60) return 'about the size of a credit card';
  if (cm2 < 130) return 'about the size of the palm of a hand';
  if (cm2 < 300) return 'about the size of an open hand';
  return 'a large, widespread area';
}
const third = t => t < 0.34 ? 'upper/proximal third (closer to the body)' : t < 0.67 ? 'middle third' : 'lower/distal third (further from the body)';

function analyzeMark(m) { if (!B) return null; return m.kind === 'area' ? analyzeArea(m) : m.kind === 'line' ? analyzeLine(m) : analyzePoint(m); }

function analyzeArea(m) {
  const w = m.w; let area = 0;
  const T = { side: {}, zone: {}, asp: {}, m: {}, s: {}, b: {}, nv: {}, derm: {} }; const visc = new Set(); const lv = []; const ys = [], xs = [], zs = []; const segs = {};
  for (let v = 0; v < B.n; v++) {
    if (w[v] <= 0.25) continue; const a = B.varea[v] * w[v]; area += B.varea[v]; const R = B.cls(v);
    tallyAdd(T.side, R.side, a); tallyAdd(T.zone, R.side + '|' + R.zone, a); tallyAdd(T.asp, R.asp, a); tallyAdd(T.derm, R.derm, a);
    for (const k of ['m', 's', 'b', 'nv']) R[k].forEach((id, i) => tallyAdd(T[k], id, a * (i ? 0.6 : 1)));
    R.visc.forEach(x => visc.add(x));
    if (B.lvl[v] >= 0 && (R.seg === 'trunk' || R.seg === 'neck') && (R.asp || '').startsWith('posterior')) lv.push(B.lvl[v]);
    ys.push(B.pos[v * 3 + 1]); xs.push(B.pos[v * 3]); zs.push(B.pos[v * 3 + 2]);
    if (B.tArr[v] >= 0) (segs[R.side + '|' + R.seg] ||= []).push(B.tArr[v]);
  }
  if (!area) return null;
  const range = a => { a.sort((x, y) => x - y); return a.length ? (a[Math.floor(a.length * 0.95)] - a[Math.floor(a.length * 0.05)]) * 100 : 0; };
  const sides = ranked(T.side), st = sideText(sides);
  const zones = ranked(T.zone, 0.1).map(z => { const [side, zone] = z.k.split('|'); return { side, zone, f: z.f }; });
  lv.sort((a, b) => a - b);
  const levels = lv.length > 10 ? [LEVELS[lv[Math.floor(lv.length * 0.05)]].name, LEVELS[lv[Math.floor(lv.length * 0.95)]].name] : null;
  const segRanges = Object.entries(segs).filter(([, a]) => a.length > 8).map(([k, a]) => { a.sort((x, y) => x - y); const [side, seg] = k.split('|'); return { side, seg, lo: a[Math.floor(a.length * 0.05)], hi: a[Math.floor(a.length * 0.95)] }; });
  return {
    kind: 'area', areaCm2: area * 1e4, sides, sideLong: st.long, sideShort: st.short, zones, asp: ranked(T.asp, 0.2),
    muscles: ranked(T.m, 0.06).slice(0, 6), soft: ranked(T.s, 0.06).slice(0, 6), bones: ranked(T.b, 0.08).slice(0, 5), nerves: ranked(T.nv, 0.06).slice(0, 6), derms: ranked(T.derm, 0.08).slice(0, 4),
    visc: [...visc].slice(0, 5), levels, height: range(ys), width: Math.max(range(xs), range(zs)), segRanges,
  };
}
function analyzeLine(m) {
  if (!m.pts || m.pts.length < 2) return null;
  const Rs = m.pts.map(v => B.cls(v)); let L = 0;
  for (let i = 1; i < m.pts.length; i++) L += vpos(m.pts[i]).distanceTo(vpos(m.pts[i - 1]));
  const seq = []; Rs.forEach(R => { const k = R.side + '|' + R.zone; if (!seq.length || seq[seq.length - 1].k !== k) seq.push({ k, R, n: 1 }); else seq[seq.length - 1].n++; });
  const zoneSeq = seq.filter((s, i) => i === 0 || i === seq.length - 1 || s.n >= 2).map(s => s.R);
  const dseq = []; Rs.forEach(R => { if (R.derm && dseq[dseq.length - 1] !== R.derm) dseq.push(R.derm); });
  const T = { nv: {}, derm: {}, m: {}, side: {} }; Rs.forEach(R => { R.nv.forEach(id => tallyAdd(T.nv, id, 1)); tallyAdd(T.derm, R.derm, 1); R.m.forEach((id, i) => tallyAdd(T.m, id, i ? 0.5 : 1)); tallyAdd(T.side, R.side, 1); });
  const start = Rs[0], end = Rs[Rs.length - 1];
  const a = { kind: 'line', Rs, lengthCm: L * 100, start, end, zoneSeq, dseq, nerves: ranked(T.nv, 0.2).slice(0, 5), derms: ranked(T.derm), muscles: ranked(T.m, 0.12).slice(0, 5), sides: ranked(T.side) };
  a.startSide = start.side === 'left' ? 'L' : start.side === 'right' ? 'R' : 'Mid';
  a.patterns = linePatterns(a);
  return a;
}
function analyzePoint(m) { if (!m.pts || !m.pts.length) return null; const R = B.cls(m.pts[0]); return { kind: 'point', R, sideShort: R.side === 'left' ? 'Left' : R.side === 'right' ? 'Right' : 'Midline' }; }

function linePatterns(a) {
  const P = [], Rs = a.Rs, n = Rs.length, segs = Rs.map(R => R.seg), zones = Rs.map(R => R.zone);
  const first = Rs.slice(0, Math.max(2, Math.ceil(n * 0.35)));
  const startsLumbo = first.some(R => LUMBO.test(R.zone));
  const belowKnee = segs.some(s => ['lower leg', 'ankle', 'foot'].includes(s));
  const backThigh = zones.some(z => /back of the thigh/.test(z));
  const frontThigh = zones.some(z => /front of the thigh|femoral triangle|groin/.test(z));
  const startsNeck = first.some(R => ['neck', 'shoulder'].includes(R.seg) || /upper back|shoulder blade|trapezius|supraspinous|infraspinous/.test(R.zone));
  const belowElbow = segs.some(s => ['forearm', 'wrist', 'hand'].includes(s));
  const upperArmOnly = segs.includes('upper arm') && !belowElbow;
  const toHead = segs.includes('head');
  const endD = (a.end.derm || '').match(/[CTLS]\d/)?.[0];
  const topNerve = a.nerves[0];
  const sidesBoth = a.sides.filter(s => s.k !== 'midline' && s.f > 0.15).length > 1;
  if (startsLumbo && belowKnee) P.push(`This is a sciatic-type pattern: it runs from the low back/buttock along the course of the sciatic nerve to below the knee. Pain that travels below the knee in a band like this is typical of lumbosacral radiculopathy (a pinched or irritated nerve root in the low back, most often L4, L5 or S1). The end point lies in the ${a.end.derm || '?'} dermatome${endD && ROOTS[endD] ? ` (${ROOTS[endD][0]})` : ''}, which points most toward the ${endD || '?'} nerve root. Less common alternatives include deep gluteal (piriformis) entrapment of the sciatic nerve, or a peroneal nerve problem at the outer knee.`);
  else if (startsLumbo && backThigh && !belowKnee) P.push('Buttock-to-back-of-thigh pain that stops above the knee is often somatic referred pain (pain felt away from its source without a pinched nerve) from the lumbar facet joints, sacroiliac joint, deep buttock muscles or the hamstring origin, rather than a nerve root.');
  if (frontThigh && (startsLumbo || segs.includes('trunk'))) P.push('Spread into the groin and front of the thigh fits the femoral nerve or the upper lumbar nerve roots (L2–L4); hip joint problems also commonly refer pain to the groin, front of the thigh and knee.');
  if (topNerve && topNerve.k === 'lfcn' && topNerve.f > 0.4) P.push('The path sits in the territory of the lateral femoral cutaneous nerve (outer front of the thigh) — the meralgia paresthetica pattern, often burning or numb and worse with tight belts or standing.');
  if (startsNeck && belowElbow) P.push(`Pain spreading from the neck/shoulder region below the elbow is typical of cervical radiculopathy (a pinched nerve root in the neck). The end point is in the ${a.end.derm || '?'} dermatome${endD && ROOTS[endD] ? ` (${ROOTS[endD][0]})` : ''}, pointing most toward the ${endD || '?'} root. Thoracic outlet compression of the brachial plexus is an alternative.`);
  else if (startsNeck && upperArmOnly) P.push('Neck/shoulder pain spreading into the upper arm but not past the elbow is commonly referred from the rotator cuff or subacromial bursa (shoulder) or from the C5 level.');
  if (startsNeck && toHead) P.push('Pain travelling from the neck or upper back into the head fits cervicogenic headache or occipital nerve irritation; trigger points in the upper trapezius, SCM and suboccipital muscles classically refer to the head and around the eye.');
  if (segs.some(s => ['forearm', 'wrist'].includes(s)) && segs.includes('hand')) {
    if (topNerve?.k === 'median_n') P.push('Forearm/wrist-to-hand symptoms along the thumb side match the median nerve (carpal tunnel is the commonest site; pronator syndrome at the elbow is less common).');
    if (topNerve?.k === 'ulnar_n') P.push('Symptoms along the little-finger side match the ulnar nerve (cubital tunnel at the elbow or Guyon\'s canal at the wrist).');
    if (topNerve?.k === 'sup_radial_n') P.push('The path follows the superficial radial nerve on the back of the thumb side (can be compressed by watchbands or cuffs).');
  }
  const chestStart = first.some(R => /breastbone|chest|sternum|costochondral|epigastrium/.test(R.zone));
  if (chestStart && (segs.some(s => ['upper arm', 'forearm', 'hand', 'shoulder'].includes(s)) || zones.some(z => /jaw|neck|throat/.test(z)))) P.push('IMPORTANT: chest pain that spreads to the arm, jaw, neck or back can come from the heart. If this is new, comes with exertion, sweating, breathlessness or nausea, it needs emergency medical care now.');
  if (first.some(R => /kidney|flank/.test(R.zone + R.visc.join(' '))) && zones.some(z => /groin|inguinal|testicle|scrotum|labium|pubic/.test(z))) P.push('Flank-to-groin ("loin to groin") pain is a classic kidney/ureter pattern (e.g. a kidney stone) and should be medically assessed, especially with blood in the urine, fever or vomiting.');
  if (first.some(R => R.side === 'right' && /upper abdomen|hypochondrium/.test(R.zone)) && Rs.some(R => R.side === 'right' && ['shoulder'].includes(R.seg) || /shoulder blade/.test(R.zone))) P.push('Right upper-abdominal pain referring to the right shoulder or shoulder blade can be gallbladder or diaphragm related.');
  const topD = a.derms[0];
  if (topD && topD.f >= 0.6 && n > 6) P.push(`Most of the path (about ${pct(topD.f)}) stays within the ${topD.k} dermatome — the strip of skin supplied by one spinal nerve${ROOTS[topD.k.match(/[CTLS]\d/)?.[0]] ? ' (' + ROOTS[topD.k.match(/[CTLS]\d/)[0]][0] + ')' : ''}.`);
  if (topNerve && topNerve.f >= 0.5 && n > 5) P.push(`The path closely follows the territory of the ${label(topNerve.k)}.`);
  if (sidesBoth) P.push('The path crosses the midline, involving both sides of the body.');
  return P;
}

function attrsText(m) {
  const a = m.attrs, q = QMAP[m.type], out = [];
  const depth = { surface: 'felt on the skin surface', muscle: 'felt in the muscle', deep: 'felt deep, as if in a joint or bone', unsure: '' }[a.depth];
  out.push(`Character: ${q.desc}; intensity ${a.intensity}/10 now and ${a.worst}/10 at its worst${depth ? '; ' + depth : ''}.`);
  if (a.timing.length) out.push(`Timing: ${a.timing.join('; ').toLowerCase()}.`);
  if (a.onset || a.duration) out.push(`Onset: ${[a.onset ? a.onset.toLowerCase() : '', a.duration ? 'present for ' + a.duration : ''].filter(Boolean).join(', ')}.`);
  if (a.aggr.length) out.push(`Worse with: ${a.aggr.join(', ').toLowerCase()}.`);
  if (a.relief.length) out.push(`Better with: ${a.relief.join(', ').toLowerCase()}.`);
  if (a.notes) out.push(`In my words: "${a.notes.trim()}"`);
  return out;
}
const labs = list => list.map(x => label(x.k));
function anatomyLines(a, inc) {
  if (!inc) return [];
  const L = [];
  if (a.muscles?.length) L.push(`Muscles: ${joinList(labs(a.muscles))}.`);
  if (a.soft?.length) L.push(`Tendons, ligaments, joints & local regions: ${joinList(labs(a.soft))}.`);
  if (a.bones?.length) L.push(`Bones: ${joinList(labs(a.bones))}.`);
  if (a.nerves?.length) L.push(`Nerves supplying/crossing the area: ${joinList(labs(a.nerves))}.`);
  if (a.derms?.length) L.push(`Dermatomes (skin strips by spinal nerve): ${a.derms.map(d => `${d.k} (≈${pct(d.f)})`).join(', ')}${(() => { const k = a.derms[0].k.match(/[CTLS]\d/)?.[0]; const trunk = (a.zones || []).some(z => /back|spine|buttock|gluteal|flank|sacr|shoulder blade|neck|chest|abdomen/.test(z.zone)); return k && ROOTS[k] && !trunk ? ` — ${k} covers the ${ROOTS[k][0]}` : ''; })()}.`);
  if (a.visc?.length) L.push(`Nearby organs/vessels for the clinician to consider: ${a.visc.join('; ')}.`);
  return L;
}
function describeMark(m, i, inc) {
  const a = analyzeMark(m); if (!a) return null; const L = [];
  const q = QMAP[m.type];
  if (m.kind === 'area') {
    const z0 = a.zones[0], more = a.zones.slice(1).map(z => z.zone + (z.side !== z0.side && z.side !== 'midline' ? ` (${z.side})` : ''));
    L.push(`${i}. ${cap(q.label)} — AREA on the ${a.sideLong} ${z0.zone}`);
    L.push(`Location: covers about ${Math.round(a.areaCm2)} cm² (${sizeWord(a.areaCm2)}), roughly ${Math.round(a.height)} cm tall × ${Math.round(a.width)} cm across, centred on the ${z0.zone}${more.length ? ' and extending into the ' + joinList(more) : ''}.`);
    if (a.asp.length) L.push(`Surface: mainly ${joinList(a.asp.map(x => ASP[x.k] || x.k))}.`);
    if (a.levels) L.push(`Vertebral height: approximately ${a.levels[0] === a.levels[1] ? 'the ' + a.levels[0] + ' level' : a.levels[0] + ' to ' + a.levels[1]}.`);
    for (const r of a.segRanges) if (r.seg !== 'trunk') L.push(`Along the ${r.side} ${r.seg}: from the ${third(r.lo)} to the ${third(r.hi)}.`);
    L.push(...anatomyLines(a, inc));
  } else if (m.kind === 'line') {
    const dirTxt = { out: 'It starts at the first point and travels outward to the end point.', in: 'It is felt travelling from the end point back toward the start.', both: 'It travels in both directions along this path.', static: 'The whole strip is painful at once (a band rather than a moving sensation).' }[m.attrs.dir];
    const mid = a.zoneSeq.slice(1, -1).map(R => R.zone);
    L.push(`${i}. ${cap(q.label)} — SPREADING PATH from the ${SIDEW[a.start.side] || a.start.side} ${a.start.zone} to the ${a.end.side !== a.start.side ? (SIDEW[a.end.side] || a.end.side) + ' ' : ''}${a.end.zone}`);
    L.push(`Path: begins at the ${a.start.zone}${mid.length ? ', passes the ' + joinList(mid) : ''}, and ends at the ${a.end.zone}; about ${Math.round(a.lengthCm)} cm long. ${dirTxt}`);
    if (inc) {
      if (a.dseq.length) L.push(`Dermatomes crossed in order: ${a.dseq.join(' → ')}.`);
      if (a.nerves.length) L.push(`Nerves along the path: ${joinList(labs(a.nerves))}.`);
      if (a.muscles.length) L.push(`Muscles along the path: ${joinList(labs(a.muscles))}.`);
      if (a.patterns.length) { L.push('Pattern notes (possibilities to consider, not a diagnosis):'); a.patterns.forEach(p => L.push('  – ' + p)); }
    }
  } else {
    const R = a.R;
    L.push(`${i}. ${cap(q.label)} — PINPOINT SPOT on the ${SIDEW[R.side] || R.side} ${R.zone}`);
    L.push(`Location: a single, precise point${R.asp ? ' on the ' + (ASP[R.asp] || R.asp) + ' surface' : ''}.`);
    if (m.attrs.pressRepro) L.push('Pressing on this spot reproduces the usual pain.');
    if (m.attrs.pressRefers) L.push('Pressing on this spot sends pain to another area (referred pain).');
    if (inc) {
      const fake = { muscles: R.m.map(k => ({ k })), soft: R.s.map(k => ({ k })), bones: R.b.map(k => ({ k })), nerves: R.nv.map(k => ({ k })), derms: R.derm ? [{ k: R.derm, f: 1 }] : [], visc: R.visc };
      L.push(...anatomyLines(fake, true).map(s => s.replace(' (≈100%)', '')));
      if ((m.attrs.pressRepro || m.attrs.pressRefers) && R.m.length) L.push(`A tender spot in muscle that reproduces or refers pain is suggestive of a myofascial trigger point in the ${label(R.m[0])}.`);
    }
  }
  L.push(...attrsText(m));
  return L;
}
function anatomyBlurbHTML(m) {
  const a = analyzeMark(m);
  if (!a) return `<p class="muted">${m.kind === 'line' ? 'Draw a path on the body to see what it crosses.' : 'Nothing marked yet — paint on the body.'}</p>`;
  const chips = ids => `<div class="chips">${ids.map(id => `<button class="chip" data-focus="${esc(id)}">${esc(label(id))}</button>`).join('')}</div>`;
  if (m.kind === 'area') return `<p><b>${esc(a.sideShort)}</b> · ${esc(a.zones.map(z => z.zone).join(' · '))} · ≈${Math.round(a.areaCm2)} cm² (${esc(sizeWord(a.areaCm2))})</p>${chips([...a.muscles, ...a.soft, ...a.bones, ...a.nerves].map(x => x.k))}${a.derms.length ? `<p class="meta">Dermatomes: ${esc(a.derms.map(d => d.k).join(', '))}</p>` : ''}`;
  if (m.kind === 'line') return `<p>${esc(a.start.zone)} → ${esc(a.end.zone)} · ≈${Math.round(a.lengthCm)} cm</p><p class="meta">Dermatomes: ${esc(a.dseq.join(' → '))}</p>${chips([...a.nerves, ...a.muscles].map(x => x.k))}${a.patterns.map(p => `<p class="pat">${esc(p)}</p>`).join('')}`;
  return `<p><b>${esc(a.sideShort)}</b> · ${esc(a.R.zone)}</p>${chips([...a.R.m, ...a.R.s, ...a.R.b, ...a.R.nv])}`;
}

function genPrompt() {
  const out = $('#promptOut'); if (!B || !out) return;
  const P = S.patient, self = P.perspective !== 'other', inc = $('#incAnat').checked;
  const I = self ? 'I' : 'The patient', my = self ? 'my' : 'their';
  const lines = [];
  const purpose = S.purpose;
  const head = {
    physician: 'PAIN DESCRIPTION FOR CLINICAL REVIEW',
    research: 'REQUEST: EVIDENCE-BASED SELF-MANAGEMENT FOR THE PAIN DESCRIBED BELOW',
    differential: 'REQUEST: WHAT COULD BE CAUSING THIS PAIN, AND HOW WOULD A CLINICIAN TELL?',
    full: 'REQUEST: FULL ASSESSMENT AND MANAGEMENT IDEAS FOR THE PAIN DESCRIBED BELOW',
  }[purpose];
  lines.push(head, '');
  lines.push(`${self ? 'I made' : 'This was made with'} a detailed 3D body pain map. Left and right always mean ${self ? 'my own' : 'the patient\'s own'} left and right. Medical terms have plain-English explanations in brackets.${inc ? ` The anatomical structures listed are inferred from where each mark sits on a standard ${S.sex} body model — they are candidates to consider, not a diagnosis.` : ''}`, '');
  // context
  const ctx = [];
  ctx.push(`Sex: ${S.sex}`); if (P.age) ctx.push(`Age: ${P.age}`); if (P.height) ctx.push(`Height: ${P.height}`); if (P.weight) ctx.push(`Weight: ${P.weight}`); if (P.hand) ctx.push(`Dominant hand: ${P.hand}`);
  lines.push('ABOUT ' + (self ? 'ME' : 'THE PATIENT'), '- ' + ctx.join(' · '));
  if (P.occupation) lines.push('- Work / daily posture: ' + P.occupation);
  if (P.activity) lines.push('- Activity & sport: ' + P.activity);
  if (P.story) lines.push('- How it started: ' + P.story);
  if (P.conditions) lines.push('- Relevant conditions, injuries or surgery: ' + P.conditions);
  if (P.meds) lines.push('- Current medicines: ' + P.meds);
  if (P.tried) lines.push('- Already tried: ' + P.tried);
  if (P.goals) lines.push('- Goals: ' + P.goals);
  if (P.flags.length) lines.push('- WARNING SIGNS PRESENT: ' + P.flags.join('; ') + '.');
  else if (P.noFlags) lines.push('- Warning signs checked and none present (no saddle numbness, bladder/bowel change, fever, weight loss, cancer history, major trauma, progressive weakness, chest pain or calf swelling).');
  lines.push('');
  const marks = S.marks.filter(m => m.visible);
  const desc = marks.map((m, i) => describeMark(m, i + 1, inc)).filter(Boolean);
  lines.push(`PAIN MAP — ${desc.length} marked ${desc.length === 1 ? 'finding' : 'findings'}`);
  if (!desc.length) lines.push('(No marks yet — paint areas, draw spreading paths or place points on the body.)');
  desc.forEach(d => { lines.push(''); lines.push(d[0]); d.slice(1).forEach(s => lines.push('   ' + s)); });
  // overall
  if (desc.length > 1) {
    lines.push('', 'OVERALL PATTERN');
    const an = marks.map(m => ({ m, a: analyzeMark(m) })).filter(x => x.a);
    const sides = new Set(); an.forEach(({ a }) => { const s = a.kind === 'area' ? a.sideShort : a.kind === 'line' ? (a.sides[0]?.k) : a.R.side; sides.add(String(s).toLowerCase()); });
    lines.push(`- Sides involved: ${[...sides].map(s => s === 'left' ? 'left' : s === 'right' ? 'right' : s).join(', ')}.`);
    for (const { m, a } of an) if (a.kind === 'line') {
      const st = m.pts[0], en = m.pts[m.pts.length - 1];
      for (const { m: m2 } of an) if (m2.kind === 'area') { const near = v => { let hit = false; radiusQuery([B.pos[v * 3], B.pos[v * 3 + 1], B.pos[v * 3 + 2]], 0.03, u => { if (m2.w[u] > 0.3) hit = true; }); return hit; }; if (near(st)) lines.push(`- "${m.name}" starts inside "${m2.name}".`); else if (near(en)) lines.push(`- "${m.name}" ends inside "${m2.name}".`); }
    }
    const qs = [...new Set(marks.map(m => QMAP[m.type].label.toLowerCase()))];
    lines.push(`- Sensations described: ${joinList(qs)}.`);
    if (marks.some(m => ['tingling', 'numb', 'burning', 'shooting', 'weak'].includes(m.type))) lines.push('- Nerve-type symptoms (tingling, numbness, burning, shooting or weakness) are present alongside the pain.');
  }
  lines.push('');
  const ask = {
    physician: [`QUESTIONS ${self ? 'I WOULD LIKE' : 'THE PATIENT WOULD LIKE'} TO DISCUSS`, ...(P.questions ? P.questions.split(/\n+/).map(s => '- ' + s.trim()).filter(s => s.length > 2) : []), '- What is the most likely source of this pain, and what else should be ruled out?', '- Which examination findings or tests would confirm it?', '- What should I do, and avoid, while it settles? When should it improve?', '- Which warning signs mean I should seek urgent care?'],
    research: ['WHAT I WOULD LIKE FROM YOU', '1. Explain in plain English (with the medical term in brackets) which structures are most likely involved and why, based on the location, spread and behaviour above. Say how confident you are.', '2. Suggest evidence-based exercises, stretches and mobility drills that target those structures, with sets/reps or hold times, how often, how to progress, and how pain should respond (what is acceptable vs. a sign to back off).', '3. Suggest self-massage, trigger-point or acupressure points, heat/cold, sleep positions and ergonomic or activity changes, with the evidence strength for each.', '4. List what to avoid for now.', '5. List the warning signs that mean I should see a doctor promptly or go to emergency care.', '6. Cite reputable sources (clinical guidelines, systematic reviews) and note where evidence is weak. Do not present this as a diagnosis.'],
    differential: ['WHAT I WOULD LIKE FROM YOU', '1. Reason like an experienced musculoskeletal and pain clinician. List the most likely explanations, ranked, with the specific features above that support or argue against each (plain English with the medical term in brackets).', '2. List less likely but important causes that should be ruled out.', '3. For each, give the history questions and physical examination tests that would tell them apart.', '4. Say which investigations, if any, would be appropriate and when, and which type of clinician to see.', '5. List red flags that would make this urgent.', '6. Be clear about uncertainty; this is to prepare for a medical appointment, not to replace one.'],
    full: ['WHAT I WOULD LIKE FROM YOU', '1. The most likely structures and causes, ranked, with reasoning from the pattern above (plain English with medical terms in brackets), plus important causes to rule out.', '2. Questions and examination tests a clinician would use to confirm or exclude each.', '3. A staged self-management plan: exercises, stretches and mobility work (with dosage and progression), self-massage / trigger-point / acupressure points, heat or cold, posture and activity changes, and what to avoid.', '4. When to seek care and which clinician, and red flags that need urgent attention.', '5. Cite reputable sources and state evidence strength. Do not present this as a definitive diagnosis.'],
  }[purpose];
  lines.push(...ask);
  if (P.extra) lines.push('', 'ALSO: ' + P.extra);
  out.value = lines.join('\n');
  $('#promptCount').textContent = out.value.length.toLocaleString() + ' characters · ' + out.value.split(/\s+/).length.toLocaleString() + ' words';
}
