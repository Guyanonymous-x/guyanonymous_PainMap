// ===================== surface classification =====================
// Returns { seg, zone, side, asp, m[], b[], s[], nv[], derm, visc[] } for a surface point.
// zone strings use "medical term (plain English)".
const ASP = {
  anterior: 'anterior (front)', posterior: 'posterior (back)', lateral: 'lateral (outer side)', medial: 'medial (inner side)',
  anterolateral: 'anterolateral (front-outer)', anteromedial: 'anteromedial (front-inner)', posterolateral: 'posterolateral (back-outer)', posteromedial: 'posteromedial (back-inner)',
  superior: 'superior (top)', inferior: 'inferior (underside)', palmar: 'palmar (palm side)', dorsal: 'dorsal (back of the hand / top of the foot)', plantar: 'plantar (sole)',
};
function sector(th) { // th: 0 anterior, +90 lateral, ±180 posterior, -90 medial
  const a = ((th % 360) + 540) % 360 - 180;
  const names = ['posterior', 'posteromedial', 'medial', 'anteromedial', 'anterior', 'anterolateral', 'lateral', 'posterolateral', 'posterior'];
  return names[Math.round((a + 180) / 45)];
}
function quad(th) { const a = Math.abs(th); if (a <= 45) return 'anterior'; if (a >= 135) return 'posterior'; return th > 0 ? 'lateral' : 'medial'; }
const ANT_DERM = [[1.405, 'C4'], [1.40, 'T2'], [1.34, 'T3'], [1.28, 'T4'], [1.24, 'T5'], [1.20, 'T6'], [1.16, 'T7'], [1.12, 'T8'], [1.08, 'T9'], [1.04, 'T10'], [1.0, 'T11'], [0.945, 'T12'], [-1, 'L1']];
function antDerm(y) { for (const [t, d] of ANT_DERM) if (y >= t) return d; return 'L1'; }
function postDerm(y) { if (y > 1.43) return 'C4'; const L = LEVELS[levelFromY(y)]; if (L.g === 'T') return L.name === 'T1' ? 'T2' : L.name; if (L.g === 'C') return 'C4'; if (y > 1.06) return 'L1'; if (y > 1.0) return 'L2'; return 'L3'; }
function segT(p, a, b) { const ba = sub(b, a); const t = clamp(dot(sub(p, a), ba) / dot(ba, ba), 0, 1); return { t, c: lerp3(a, b, t) }; }

function classify(p, n, tag, P) {
  const x = p[0], y = p[1], z = p[2], X = Math.abs(x), sg = x >= 0 ? 1 : -1;
  const R = { seg: '', zone: '', side: X < 0.012 ? 'midline' : (x > 0 ? 'left' : 'right'), asp: '', m: [], b: [], s: [], nv: [], derm: '', visc: [], lvl: -1 };
  const put = (k, ...ids) => { for (const id of ids) if (id && !R[k].includes(id)) R[k].push(id); };
  R.put = put;
  const part = tag.part;
  if (['penis', 'glans', 'testis', 'scrotum', 'labia_maj', 'labia_min', 'clitoris', 'vagina', 'anus', 'mons'].includes(part) || (y < 0.9 && X < 0.05 && n[1] < -0.35 && y > 0.75)) { genitalZone(R, p, n, tag, P); return fin(R); }
  if (['palm', 'thenar', 'finger', 'thumb'].includes(part)) { handZone(R, p, n, tag, P); return fin(R); }
  if (['heel', 'foot', 'toe'].includes(part) || (y < 0.06)) { footZone(R, p, n, tag, P); return fin(R); }
  const A = P.arm[sg > 0 ? 0 : 1];
  const q = sub(p, A.S), a = dot(q, A.d), rv = sub(q, mul(A.d, a)), perp = len(rv);
  if ((a > 0.03 && perp < 0.085 && a < P.Lua + P.Lfa + 0.03) || ['upperarm', 'forearm'].includes(part)) { armZone(R, p, n, P, A, a, rv); return fin(R); }
  if (y > 1.555 || ['head', 'jaw', 'chin', 'brow', 'nose', 'lips', 'eye', 'ear', 'cheek'].includes(part)) { headZone(R, p, n, tag, P); return fin(R); }
  if (y > 1.455 && X < 0.085) { neckZone(R, p, n, P); return fin(R); }
  if (y < 0.805 || ['thigh', 'knee', 'shin', 'calf', 'ankle'].includes(part)) { legZone(R, p, n, tag, P); return fin(R); }
  torsoZone(R, p, n, tag, P); return fin(R);
}
function fin(R) { delete R.put; return R; }

// ---------------- head & face ----------------
function headZone(R, p, n, tag, P) {
  const put = R.put, C = P.headC, X = Math.abs(p[0]), dy = p[1] - C[1], z = p[2];
  R.seg = 'head';
  const front = n[2] > 0.45 && z > 0.04, back = n[2] < -0.45, top = n[1] > 0.72 && dy > 0.06;
  if (tag.part === 'ear') { R.zone = 'external ear'; R.asp = 'lateral'; put('s', 'ear'); put('nv', 'great_auric_n', 'trigeminal_v3'); put('visc', 'ear canal'); R.derm = 'C2–C3 / V3'; return; }
  if (tag.part === 'eye') { R.zone = 'eye (eyeball / eyelid)'; R.asp = 'anterior'; put('s', 'eye'); put('m', 'orbicularis_oculi'); put('nv', 'trigeminal_v1', 'facial_n'); R.derm = 'V1'; return; }
  if (top) { R.zone = 'vertex (top of the head)'; R.asp = 'superior'; put('b', 'skull'); put('m', z > 0 ? 'frontalis' : 'occipitalis'); put('nv', z > 0.02 ? 'trigeminal_v1' : 'greater_occ_n'); R.derm = z > 0.02 ? 'V1' : 'C2'; return; }
  if (front) {
    R.asp = 'anterior';
    if (dy > 0.04) { R.zone = X < 0.02 && dy < 0.055 ? 'glabella (between the eyebrows)' : 'forehead'; put('m', X < 0.02 && dy < 0.055 ? 'corrugator' : 'frontalis'); put('b', 'skull'); put('nv', 'trigeminal_v1', 'facial_n'); R.derm = 'V1'; if (X < 0.04) put('visc', 'frontal sinus'); return; }
    if (dy > 0.022) { R.zone = X < 0.015 ? 'glabella / bridge of the nose' : 'eyebrow (supraorbital ridge)'; put('m', X < 0.015 ? 'corrugator' : 'orbicularis_oculi', 'frontalis'); put('b', 'skull'); put('nv', 'trigeminal_v1', 'facial_n'); R.derm = 'V1'; return; }
    if (dy > -0.005) {
      if (X < 0.014) { R.zone = 'nasal bridge (upper nose)'; put('m', 'nasalis'); put('b', 'facial_bones'); put('nv', 'trigeminal_v1'); R.derm = 'V1'; return; }
      if (X < 0.052) { R.zone = 'periorbital region (around the eye)'; put('m', 'orbicularis_oculi'); put('b', 'facial_bones'); put('s', 'eye'); put('nv', dy > 0.005 ? 'trigeminal_v1' : 'trigeminal_v2', 'facial_n'); R.derm = dy > 0.005 ? 'V1' : 'V2'; return; }
      R.zone = 'temple (lateral orbit)'; put('m', 'temporalis', 'orbicularis_oculi'); put('b', 'skull'); put('nv', 'trigeminal_v2', 'facial_n'); R.derm = 'V2'; return;
    }
    if (dy > -0.042) {
      if (tag.part === 'nose' || X < 0.016) { R.zone = 'nose'; put('m', 'nasalis'); put('b', 'facial_bones'); put('nv', 'trigeminal_v1', 'trigeminal_v2'); put('visc', 'nasal cavity'); R.derm = 'V1–V2'; return; }
      if (dy < -0.048 + 0.012 && X < 0.03) { R.zone = 'upper lip'; put('m', 'orbicularis_oris', 'levator_labii'); put('b', 'facial_bones', 'teeth'); put('nv', 'trigeminal_v2', 'facial_n'); R.derm = 'V2'; put('visc', 'upper teeth & gums'); return; }
      if (X < 0.045) { R.zone = 'cheek (over the maxillary sinus)'; put('m', 'levator_labii', 'zygomaticus'); put('b', 'facial_bones'); put('nv', 'trigeminal_v2', 'facial_n'); put('visc', 'maxillary sinus', 'upper teeth'); R.derm = 'V2'; return; }
      R.zone = 'cheekbone (zygomatic) region'; put('m', 'zygomaticus', 'masseter'); put('b', 'facial_bones'); put('nv', 'trigeminal_v2', 'facial_n'); R.derm = 'V2'; return;
    }
    if (dy > -0.07) {
      if (X < 0.024) { R.zone = tag.part === 'lips' ? 'lips (mouth)' : 'mouth region'; put('m', 'orbicularis_oris'); put('b', 'teeth', 'mandible', 'facial_bones'); put('nv', dy > -0.058 ? 'trigeminal_v2' : 'trigeminal_v3', 'facial_n'); R.derm = dy > -0.058 ? 'V2' : 'V3'; put('visc', 'teeth & gums'); return; }
      if (X < 0.045) { R.zone = 'corner of the mouth / inner cheek'; put('m', 'buccinator', 'zygomaticus', 'depressor_anguli'); put('b', 'teeth', 'mandible'); put('nv', 'trigeminal_v3', 'facial_n'); R.derm = 'V3'; return; }
      R.zone = 'outer cheek over the masseter (chewing muscle)'; put('m', 'masseter', 'buccinator'); put('b', 'mandible', 'teeth'); put('nv', 'trigeminal_v3', 'facial_n'); put('s', 'parotid'); R.derm = 'V3'; return;
    }
    if (X < 0.025) { R.zone = 'chin (mental region)'; put('m', 'mentalis', 'depressor_anguli'); put('b', 'mandible'); put('nv', 'trigeminal_v3'); R.derm = 'V3'; return; }
    R.zone = 'jawline (mandible body)'; put('m', 'depressor_anguli', 'masseter', 'platysma'); put('b', 'mandible', 'teeth'); put('nv', 'trigeminal_v3', 'facial_n'); R.derm = 'V3'; return;
  }
  if (back) {
    R.asp = 'posterior';
    if (dy < -0.045) { R.zone = 'suboccipital region (base of the skull)'; put('m', 'suboccipitals', 'upper_trap', 'splenius'); put('b', 'occipital_bone', 'vert:C1'); put('nv', 'greater_occ_n'); R.derm = 'C2'; return; }
    R.zone = 'occiput (back of the head)'; put('m', 'occipitalis'); put('b', 'occipital_bone'); put('nv', X < 0.045 ? 'greater_occ_n' : 'lesser_occ_n'); R.derm = 'C2'; return;
  }
  // side of head
  R.asp = 'lateral';
  if (dy > 0.0 && z > -0.03) { R.zone = 'temple (temporal region)'; put('m', 'temporalis'); put('b', 'skull'); put('nv', 'trigeminal_v3', 'facial_n'); R.derm = 'V2–V3'; return; }
  if (dy > 0.0) { R.zone = 'side of the head above/behind the ear (parietal-temporal)'; put('m', 'temporalis', 'occipitalis'); put('b', 'skull'); put('nv', 'lesser_occ_n'); R.derm = 'C2–C3'; return; }
  if (dy > -0.05) {
    if (z > 0.012) { R.zone = 'TMJ region (jaw joint, in front of the ear)'; put('s', 'tmj', 'tmj_disc', 'parotid'); put('m', 'masseter', 'temporalis'); put('b', 'mandible'); put('nv', 'trigeminal_v3', 'facial_n'); R.derm = 'V3'; return; }
    if (z > -0.025) { R.zone = 'ear region'; put('s', 'ear'); put('nv', 'great_auric_n', 'trigeminal_v3'); R.derm = 'C2–C3'; return; }
    R.zone = 'mastoid region (behind the ear)'; put('b', 'mastoid'); put('m', 'scm', 'splenius'); put('nv', 'lesser_occ_n', 'great_auric_n'); R.derm = 'C2'; return;
  }
  R.zone = 'angle of the jaw'; put('m', 'masseter', 'platysma'); put('b', 'mandible'); put('s', 'parotid'); put('nv', 'great_auric_n', 'facial_n'); R.derm = 'C3'; return;
}

// ---------------- neck ----------------
function neckZone(R, p, n, P) {
  const put = R.put, X = Math.abs(p[0]), y = p[1];
  R.seg = 'neck'; R.lvl = levelFromY(y); const lv = LEVELS[R.lvl].g === 'C' ? LEVELS[R.lvl].name : 'C7';
  const front = n[2] > 0.4, back = n[2] < -0.35;
  if (back) {
    R.asp = 'posterior';
    if (X < 0.016) { R.zone = 'back of the neck, midline (cervical spinous processes)'; put('b', 'vert:' + lv); put('s', 'nuchal_lig', 'supraspinous_lig'); put('m', 'cerv_paraspinals', 'upper_trap'); put('nv', 'dorsal_rami'); }
    else { R.zone = 'back of the neck beside the spine (cervical paraspinal region)'; put('m', 'upper_trap', 'splenius', 'cerv_paraspinals'); if (y > 1.53) put('m', 'suboccipitals'); if (X > 0.032) put('m', 'levator_scap'); put('b', 'vert:' + lv); put('s', 'facet_joints'); put('nv', 'dorsal_rami', 'root:' + lv); if (y > 1.52) put('nv', 'greater_occ_n'); }
    R.derm = y > 1.515 ? 'C3' : 'C4'; return;
  }
  if (front) {
    R.asp = 'anterior';
    if (X < 0.022) { R.zone = 'front of the throat (anterior neck midline)'; put('s', 'thyroid_cart'); put('m', 'platysma'); put('visc', 'larynx (voice box)', 'trachea (windpipe)', 'thyroid gland'); put('nv', 'cervical_plexus'); R.derm = 'C3'; return; }
    R.zone = 'front-side of the neck (anterior triangle)'; put('m', 'scm', 'platysma'); if (X > 0.04) put('m', 'scalenes'); put('nv', 'cervical_plexus'); if (y < 1.49 && X > 0.035) put('nv', 'brachial_plexus'); put('visc', 'carotid artery & jugular vein'); R.derm = 'C3'; return;
  }
  R.asp = 'lateral';
  R.zone = 'side of the neck (posterior triangle)'; put('m', 'scalenes', p[2] > 0 ? 'scm' : 'levator_scap'); if (p[2] < -0.02) put('m', 'upper_trap');
  put('b', 'vert:' + lv); put('nv', 'cervical_plexus', 'spinal_accessory_n', 'root:' + lv); if (y < 1.5) put('nv', 'brachial_plexus');
  R.derm = y > 1.5 ? 'C3' : 'C4';
}

// ---------------- arm ----------------
function armZone(R, p, n, P, A, a, rv) {
  const put = R.put; R.side = A.sg > 0 ? 'left' : 'right';
  const lat = dot(rv, A.u), ant = rv[2], th = Math.atan2(lat, ant) / deg, q4 = quad(th);
  R.asp = sector(th);
  const Lua = P.Lua, Lfa = P.Lfa, tot = Lua + Lfa;
  if (a < Lua * 0.86) {
    const t = a / Lua; R.seg = 'upper arm'; R.t = t; put('b', 'humerus');
    if (t < 0.26) {
      R.seg = 'shoulder';
      if (q4 === 'anterior') { R.zone = 'front of the shoulder (anterior deltoid region)'; put('m', 'deltoid_ant', 'biceps', 'subscapularis'); put('s', 'biceps_long_t', 'gh_joint', 'rotator_cuff_t'); put('nv', 'axillary_n'); R.derm = 'C5'; }
      else if (q4 === 'lateral') { R.zone = 'outer shoulder (lateral deltoid region)'; put('m', 'deltoid_mid', 'supraspinatus'); put('s', 'rotator_cuff_t', 'subacromial_bursa'); if (t < 0.12) put('b', 'acromion'); put('nv', 'axillary_n'); R.derm = 'C5'; }
      else if (q4 === 'posterior') { R.zone = 'back of the shoulder (posterior deltoid region)'; put('m', 'deltoid_post', 'infraspinatus', 'teres_minor'); put('s', 'rotator_cuff_t', 'gh_joint'); put('nv', 'axillary_n', 'suprascap_n'); R.derm = 'C5'; }
      else { R.zone = 'axilla (armpit)'; put('m', th < -90 ? 'teres_major' : 'pec_major', 'coracobrachialis', th < -90 ? 'lats' : 'subscapularis'); put('s', 'axilla'); put('nv', 'brachial_plexus', 'med_cut_n'); put('visc', 'axillary lymph nodes'); R.derm = 'T2'; }
      return;
    }
    if (q4 === 'anterior') { R.zone = 'front of the upper arm (biceps region)'; put('m', 'biceps'); if (t > 0.5) put('m', 'brachialis'); if (t < 0.45 && th < -15) put('m', 'coracobrachialis'); put('nv', 'musculocut_n'); R.derm = th > 0 ? 'C5' : 'T1'; }
    else if (q4 === 'lateral') { R.zone = 'outer upper arm'; if (t < 0.5) put('m', 'deltoid_mid', 'triceps'); else put('m', 'brachialis', 'brachioradialis', 'triceps'); if (t > 0.3 && t < 0.75) put('nv', 'radial_n'); if (t < 0.45) put('nv', 'axillary_n'); R.derm = 'C5'; }
    else if (q4 === 'posterior') { R.zone = 'back of the upper arm (triceps region)'; put('m', 'triceps'); if (t > 0.3 && t < 0.7) put('nv', 'radial_n'); R.derm = th > 0 ? 'C5' : 'T1'; }
    else { R.zone = 'inner upper arm'; put('m', 'biceps', 'triceps'); if (t < 0.5) put('m', 'coracobrachialis'); put('nv', 'median_n', 'ulnar_n', 'med_cut_n'); put('visc', 'brachial artery'); R.derm = 'T1'; }
    return;
  }
  if (a < Lua + Lfa * 0.14) {
    R.seg = 'elbow';
    if (q4 === 'anterior') { R.zone = 'front of the elbow (cubital fossa)'; put('m', 'biceps', 'brachialis'); if (th < 0) put('m', 'pronator_teres'); if (th > 30) put('m', 'brachioradialis'); put('s', 'biceps_distal_t', 'cubital_fossa', 'elbow_joint'); put('nv', 'median_n', 'musculocut_n'); put('b', 'humerus'); R.derm = th > 0 ? 'C6' : 'T1'; }
    else if (q4 === 'lateral') { R.zone = 'outer elbow (lateral epicondyle)'; put('m', 'wrist_ext', 'brachioradialis', 'supinator'); put('s', 'common_ext_t', 'annular_lig', 'elbow_joint'); put('b', 'humerus', 'radius'); put('nv', 'radial_n'); R.derm = 'C6'; }
    else if (q4 === 'posterior') { R.zone = 'back of the elbow (olecranon)'; put('m', 'triceps'); put('s', 'triceps_t', 'olecranon_bursa', 'elbow_joint'); put('b', 'ulna'); if (th < -150) put('nv', 'ulnar_n'); R.derm = 'C7'; }
    else { R.zone = 'inner elbow (medial epicondyle)'; put('m', 'wrist_flex', 'pronator_teres', 'fcu'); put('s', 'common_flex_t', 'ucl_elbow'); if (th < -110) put('s', 'cubital_tunnel'); put('b', 'humerus'); put('nv', 'ulnar_n', 'med_cut_n'); R.derm = 'T1'; }
    return;
  }
  if (a < tot - Lfa * 0.1) {
    const t = (a - Lua) / Lfa; R.seg = 'forearm'; R.t = t;
    if (q4 === 'anterior') { R.zone = 'front of the forearm (flexor / palm side)'; put('m', 'wrist_flex'); if (t < 0.4 && th > -10) put('m', 'pronator_teres'); if (th < -25) put('m', 'fcu'); put('nv', 'median_n', th > 0 ? 'musculocut_n' : 'med_cut_n'); put('b', 'radius', 'ulna'); R.derm = th >= 0 ? 'C6' : (t < 0.5 ? 'T1' : 'C8'); }
    else if (q4 === 'lateral') { R.zone = 'thumb side of the forearm (radial border)'; put('m', 'brachioradialis', 'wrist_ext'); if (t > 0.55) put('m', 'thumb_abd'); if (t > 0.35) put('nv', 'sup_radial_n'); put('nv', 'musculocut_n'); put('b', 'radius'); R.derm = 'C6'; }
    else if (q4 === 'posterior') { R.zone = 'back of the forearm (extensor side)'; put('m', 'wrist_ext'); if (t < 0.3) put('m', 'supinator'); if (t > 0.5 && th > 120) put('m', 'thumb_abd'); put('nv', 'radial_n'); put('b', 'radius', 'ulna'); R.derm = 'C7'; }
    else { R.zone = 'little-finger side of the forearm (ulnar border)'; put('m', 'fcu', 'wrist_ext'); put('nv', 'ulnar_n', 'med_cut_n'); put('b', 'ulna'); R.derm = t < 0.5 ? 'T1' : 'C8'; }
    return;
  }
  R.seg = 'wrist'; put('b', 'carpals');
  if (q4 === 'anterior') {
    if (th < -25) { R.zone = 'palm side of the wrist, little-finger side (Guyon\'s canal)'; put('m', 'fcu', 'hypothenar'); put('s', 'guyon', 'tfcc'); put('nv', 'ulnar_n'); R.derm = 'C8'; }
    else { R.zone = 'palm side of the wrist (carpal tunnel)'; put('s', 'carpal_tunnel', 'wrist_flex_t', 'flexor_retinac', 'wrist_joint'); put('nv', 'median_n'); put('b', 'radius'); R.derm = th > 15 ? 'C6' : 'C7'; }
  } else if (q4 === 'lateral') { R.zone = 'thumb side of the wrist (radial styloid / anatomical snuffbox)'; put('s', 'dequervain_t', 'wrist_joint'); put('m', 'thumb_abd'); put('b', 'radius'); put('nv', 'sup_radial_n'); R.derm = 'C6'; }
  else if (q4 === 'posterior') { R.zone = 'back of the wrist (dorsal wrist)'; put('s', 'wrist_ext_t', 'wrist_joint'); put('m', 'wrist_ext'); put('nv', th > 0 ? 'sup_radial_n' : 'ulnar_n'); R.derm = 'C7'; }
  else { R.zone = 'little-finger side of the wrist (ulnar styloid)'; put('s', 'tfcc', 'wrist_joint'); put('m', 'wrist_ext', 'fcu'); put('b', 'ulna'); put('nv', 'ulnar_n'); R.derm = 'C8'; }
}

// ---------------- hand ----------------
const FINGER = ['index finger', 'middle finger', 'ring finger', 'little finger'];
function handZone(R, p, n, tag, P) {
  const put = R.put, sg = p[0] >= 0 ? 1 : -1, A = P.arm[sg > 0 ? 0 : 1];
  R.side = sg > 0 ? 'left' : 'right'; R.seg = 'hand';
  const palm = n[2] > 0.3, dors = n[2] < -0.3; const b = dot(sub(p, A.W), A.u);
  R.asp = palm ? 'palmar' : dors ? 'dorsal' : (b > 0 ? 'lateral' : 'medial');
  if (tag.part === 'thumb') {
    const st = segT(p, tag.a, tag.b).t; const seg = tag.seg;
    R.zone = seg === 0 ? (st < 0.35 ? 'base of the thumb (thumb CMC joint)' : 'thumb metacarpal (thenar side of the hand)') : seg === 1 ? (st < 0.25 ? 'thumb MCP joint (thumb knuckle)' : 'thumb, proximal phalanx (lower segment)') : (st < 0.25 ? 'thumb IP joint' : 'thumb tip (distal phalanx)');
    put('b', seg === 0 ? 'metacarpals' : 'phalanges_h');
    if (seg === 0 && st < 0.35) put('s', 'cmc1');
    if (seg >= 1 && st < 0.25) put('s', 'finger_coll');
    if (palm || seg === 0) put('m', 'thenar');
    put('s', palm ? 'wrist_flex_t' : dors ? 'dequervain_t' : 'finger_coll');
    put('nv', palm ? 'median_n' : 'sup_radial_n'); R.derm = 'C6'; return;
  }
  if (tag.part === 'finger') {
    const st = segT(p, tag.a, tag.b).t, seg = tag.seg, f = FINGER[tag.i];
    const joint = st < 0.22 ? ['MCP joint (knuckle)', 'PIP joint (middle joint)', 'DIP joint (end joint)'][seg] : null;
    const phal = ['proximal phalanx (first segment)', 'middle phalanx (middle segment)', 'distal phalanx (fingertip segment)'][seg];
    R.zone = f + ', ' + (joint || phal); put('b', 'phalanges_h');
    if (joint) put('s', ['mcp_joints', 'pip_joints', 'dip_joints'][seg], 'finger_coll');
    if (seg === 0 && palm && st < 0.3) put('s', 'a1_pulley');
    put('s', palm ? 'wrist_flex_t' : 'wrist_ext_t');
    if (seg === 0) put('m', 'hand_intrinsics');
    const med = tag.i <= 1 ? 'median_n' : tag.i === 2 ? (palm ? 'median_n' : 'ulnar_n') : 'ulnar_n';
    put('nv', palm ? med : (tag.i <= 1 ? (seg === 2 ? 'median_n' : 'sup_radial_n') : 'ulnar_n')); if (tag.i === 2 && palm) put('nv', 'ulnar_n');
    R.derm = ['C6–C7', 'C7', 'C8', 'C8'][tag.i]; return;
  }
  const ah = dot(sub(p, A.W), A.d);
  if (palm) {
    if (b > 0.014) { R.zone = 'thenar eminence (thumb pad)'; put('m', 'thenar'); put('nv', 'median_n'); put('b', 'metacarpals'); R.derm = 'C6'; }
    else if (b < -0.016) { R.zone = 'hypothenar eminence (little-finger pad)'; put('m', 'hypothenar'); put('nv', 'ulnar_n'); put('b', 'metacarpals'); R.derm = 'C8'; }
    else { R.zone = ah < 0.025 ? 'heel of the palm (over the carpal tunnel exit)' : 'centre of the palm'; put('m', 'hand_intrinsics'); put('s', 'wrist_flex_t'); if (ah < 0.025) put('s', 'carpal_tunnel', 'flexor_retinac'); if (ah > 0.07) put('s', 'a1_pulley'); put('nv', 'median_n'); put('b', ah < 0.025 ? 'carpals' : 'metacarpals'); R.derm = 'C7'; }
    return;
  }
  if (dors) { R.zone = 'back of the hand (dorsum)'; put('m', 'hand_intrinsics'); put('s', 'wrist_ext_t'); put('b', ah < 0.025 ? 'carpals' : 'metacarpals'); put('nv', b > 0 ? 'sup_radial_n' : 'ulnar_n'); R.derm = b > 0.012 ? 'C6' : b < -0.012 ? 'C8' : 'C7'; return; }
  if (b > 0) { R.zone = 'thumb-side edge of the hand (first web space)'; put('m', 'thenar', 'hand_intrinsics'); put('nv', 'sup_radial_n', 'median_n'); put('b', 'metacarpals'); R.derm = 'C6'; }
  else { R.zone = 'little-finger edge of the hand'; put('m', 'hypothenar'); put('nv', 'ulnar_n'); put('b', 'metacarpals'); R.derm = 'C8'; }
}

// ---------------- leg ----------------
function legZone(R, p, n, tag, P) {
  const put = R.put, sg = p[0] >= 0 ? 1 : -1, L = P.leg[sg > 0 ? 0 : 1], y = p[1];
  R.side = sg > 0 ? 'left' : 'right';
  const upper = y > 0.47;
  const S = segT(p, upper ? L.Hj : L.K, upper ? L.K : L.A), rv = sub(p, S.c);
  const th = Math.atan2(sg * rv[0], rv[2]) / deg, q4 = quad(th); R.asp = sector(th);
  if (y < 0.13 || tag.part === 'ankle') {
    R.seg = 'ankle'; put('b', 'talus');
    if (q4 === 'anterior') { R.zone = 'front of the ankle'; put('s', 'ankle_joint', 'tib_ant_t', 'ext_toe_t'); put('nv', 'deep_peroneal_n', 'superficial_peroneal_n'); put('b', 'tibia'); R.derm = th > 0 ? 'L5' : 'L4'; }
    else if (q4 === 'lateral') { R.zone = 'outer ankle (lateral malleolus)'; put('b', 'lat_malleolus', 'fibula'); put('s', 'lat_ankle_lig'); if (th > 100) put('s', 'peroneal_t'); put('nv', th > 100 ? 'sural_n' : 'superficial_peroneal_n'); R.derm = th > 100 ? 'S1' : 'L5'; }
    else if (q4 === 'medial') { R.zone = 'inner ankle (medial malleolus)'; put('b', 'med_malleolus', 'tibia'); put('s', 'deltoid_lig', 'tib_post_t'); if (th < -110) put('s', 'tarsal_tunnel'); put('nv', th < -110 ? 'tibial_n' : 'saphenous_n'); R.derm = 'L4'; }
    else { R.zone = 'back of the ankle (Achilles insertion)'; put('s', 'achilles', 'retrocalc_bursa'); put('b', 'calcaneus'); put('nv', 'sural_n'); R.derm = 'S1'; }
    return;
  }
  if (y < 0.44) {
    const t = segT(p, L.K, L.A).t; R.seg = 'lower leg'; R.t = t;
    if (q4 === 'anterior') {
      if (th < -10) { R.zone = 'inner shin (anteromedial tibia)'; put('b', 'tibia'); put('m', 'tib_post'); put('nv', 'saphenous_n'); R.derm = 'L4'; }
      else { R.zone = 'front of the shin (tibialis anterior region)'; put('m', 'tib_ant'); if (th > 25) put('m', 'ext_dig_l'); put('nv', 'deep_peroneal_n'); if (t > 0.7) put('s', 'tib_ant_t'); put('b', 'tibia'); R.derm = th > 10 ? 'L5' : 'L4'; }
    } else if (q4 === 'lateral') { R.zone = 'outer lower leg (peroneal region)'; put('m', 'peroneals'); put('b', 'fibula'); if (t < 0.15) { put('b', 'fibular_head'); put('nv', 'common_peroneal_n'); } else put('nv', 'superficial_peroneal_n'); if (t > 0.75) put('s', 'peroneal_t'); R.derm = 'L5'; }
    else if (q4 === 'posterior') {
      if (t < 0.45) { R.zone = 'calf (gastrocnemius region)'; put('m', 'gastrocnemius', 'soleus'); }
      else if (t < 0.75) { R.zone = 'lower calf (soleus region)'; put('m', 'soleus', 'gastrocnemius'); }
      else { R.zone = 'Achilles tendon region'; put('s', 'achilles'); put('m', 'soleus'); }
      put('m', 'tib_post', 'flex_dig_l'); put('nv', 'tibial_n'); if (th > 0) put('nv', 'sural_n'); R.derm = th > 0 ? 'S1' : 'S2';
    } else { R.zone = 'inner calf (posteromedial lower leg)'; put('m', 'soleus'); if (t < 0.45) put('m', 'gastrocnemius'); put('m', 'tib_post', 'flex_dig_l'); put('b', 'tibia'); put('nv', 'saphenous_n', 'tibial_n'); R.derm = 'L4'; }
    return;
  }
  if (y < 0.57) {
    R.seg = 'knee'; put('s', 'knee_joint');
    if (q4 === 'anterior') {
      if (Math.abs(th) < 35) { R.zone = y > 0.535 ? 'above the kneecap (quadriceps tendon)' : y < 0.488 ? 'below the kneecap (patellar tendon)' : 'kneecap (patella)'; put('b', 'patella'); put('s', y > 0.535 ? 'quad_t' : y < 0.488 ? 'patellar_t' : 'prepatellar_bursa', 'knee_art'); put('nv', 'saphenous_n', 'femoral_n'); R.derm = y > 0.505 ? 'L3' : 'L4'; }
      else if (th < 0) { R.zone = 'front-inner knee'; if (y > 0.52) put('m', 'vastus_med'); put('s', 'meniscus_med', 'knee_art'); put('nv', 'saphenous_n'); R.derm = 'L3'; }
      else { R.zone = 'front-outer knee'; put('s', 'itb', 'meniscus_lat'); put('m', 'vastus_lat'); put('nv', 'lfcn'); R.derm = 'L3'; }
    } else if (q4 === 'medial') { R.zone = 'inner knee (medial joint line / MCL)'; put('s', 'mcl', 'meniscus_med'); if (y < 0.47) put('s', 'pes_anserine'); if (y > 0.53) put('m', 'vastus_med'); put('s', 'hamstring_dist_t'); put('b', 'femur', 'tibia'); put('nv', 'saphenous_n'); R.derm = y > 0.5 ? 'L3' : 'L4'; }
    else if (q4 === 'lateral') { R.zone = 'outer knee (lateral joint line / LCL)'; put('s', 'lcl', 'itb', 'meniscus_lat'); put('b', 'femur'); if (y < 0.475) { put('b', 'fibular_head'); put('nv', 'common_peroneal_n'); } if (th > 100) put('s', 'hamstring_dist_t'); R.derm = y < 0.49 ? 'L5' : 'L3'; }
    else { R.zone = 'back of the knee (popliteal fossa)'; put('m', 'popliteus', 'gastrocnemius'); put('s', 'bakers', 'hamstring_dist_t', 'pcl'); put('nv', 'tibial_n', th > 0 ? 'common_peroneal_n' : 'sural_n'); R.derm = 'S2'; }
    return;
  }
  const t = segT(p, L.Hj, L.K).t; R.seg = 'thigh'; R.t = t; put('b', 'femur');
  if (q4 === 'anterior') {
    R.zone = 'front of the thigh (quadriceps region)';
    if (Math.abs(th) <= 18) put('m', 'rectus_fem');
    else if (th > 18) put('m', 'vastus_lat', 'rectus_fem');
    else if (t > 0.65) put('m', 'vastus_med', 'sartorius');
    else { put('m', 'sartorius', 'adductors'); if (t < 0.4) { put('m', 'pectineus'); put('s', 'femoral_triangle'); R.zone = 'upper front-inner thigh (femoral triangle)'; } }
    put('nv', 'femoral_n'); R.derm = t < 0.5 ? 'L2' : 'L3';
  } else if (q4 === 'lateral') { R.zone = 'outer thigh (iliotibial band region)'; put('m', 'vastus_lat'); put('s', 'itb'); if (t < 0.4 && th < 90) put('m', 'tfl'); if (th < 100 && t < 0.75) put('nv', 'lfcn'); R.derm = t < 0.5 ? 'L2' : 'L3'; }
  else if (q4 === 'posterior') { R.zone = 'back of the thigh (hamstring region)'; if (th > 0) put('m', 'biceps_fem'); else put('m', 'semi_tend_memb'); if (Math.abs(Math.abs(th) - 180) < 20) put('m', th > 0 ? 'semi_tend_memb' : 'biceps_fem'); put('nv', 'sciatic_n', 'post_fem_cut_n'); if (t < 0.3) put('s', 'hamstring_prox_t'); R.derm = 'S2'; }
  else { R.zone = 'inner thigh (adductor region)'; put('m', 'adductors', 'gracilis'); if (t > 0.6) put('m', 'vastus_med', 'sartorius'); put('nv', 'obturator_n'); if (t > 0.6) put('nv', 'saphenous_n'); R.derm = t < 0.5 ? 'L2' : 'L3'; }
}

// ---------------- foot ----------------
const TOE = ['big toe (hallux)', '2nd toe', '3rd toe', '4th toe', '5th (little) toe'];
function footZone(R, p, n, tag, P) {
  const put = R.put, sg = p[0] >= 0 ? 1 : -1, L = P.leg[sg > 0 ? 0 : 1];
  R.side = sg > 0 ? 'left' : 'right'; R.seg = 'foot';
  const f = clamp((p[2] + 0.08) / 0.24, 0, 1), mo = sg * (p[0] - L.A[0]); // mo<0 = medial
  const plantar = n[1] < -0.55, dorsal = n[1] > 0.35, heelBack = n[2] < -0.5 && f < 0.3;
  if (tag.part === 'toe') {
    const st = segT(p, tag.a, tag.b).t;
    R.zone = TOE[tag.i] + (st < 0.25 ? ', base joint (MTP)' : st < 0.6 ? '' : ', tip'); put('b', 'phalanges_f');
    put('s', tag.i === 0 && st < 0.3 ? 'mtp1' : 'mtp_joints', plantar ? 'flex_toe_t' : 'ext_toe_t');
    R.asp = plantar ? 'plantar' : dorsal ? 'dorsal' : (sg * n[0] < 0 ? 'medial' : 'lateral');
    if (plantar) { put('nv', 'plantar_n'); R.derm = tag.i === 0 ? 'L5' : 'S1'; }
    else { put('nv', tag.i <= 1 && sg * n[0] < 0.3 ? 'deep_peroneal_n' : 'superficial_peroneal_n'); R.derm = tag.i >= 3 ? 'S1' : 'L5'; }
    return;
  }
  if (heelBack) { R.zone = 'back of the heel'; R.asp = 'posterior'; put('s', 'achilles', 'retrocalc_bursa'); put('b', 'calcaneus'); put('nv', 'sural_n'); R.derm = 'S1'; return; }
  if (plantar) {
    R.asp = 'plantar';
    if (f < 0.3) { R.zone = 'heel pad (underside of the heel)'; put('s', 'plantar_fascia'); put('b', 'calcaneus'); put('m', 'foot_intrinsics'); put('nv', 'plantar_n'); R.derm = 'S1'; }
    else if (f < 0.68) { R.zone = 'arch of the foot (midfoot sole)'; put('s', 'plantar_fascia', 'spring_lig'); put('m', 'foot_intrinsics'); put('b', 'tarsals'); put('nv', 'plantar_n'); R.derm = mo < -0.01 ? 'L5' : 'S1'; }
    else { R.zone = 'ball of the foot (under the metatarsal heads)'; put('b', 'metatarsals'); put('s', 'plantar_fascia', 'flex_toe_t'); if (mo < -0.015) put('s', 'mtp1'); else put('s', 'mtp_joints'); if (mo > 0.005 && mo < 0.03) put('s', 'mortons'); put('m', 'foot_intrinsics'); put('nv', 'plantar_n'); R.derm = mo < -0.01 ? 'L5' : 'S1'; }
    return;
  }
  if (dorsal) {
    R.asp = 'dorsal';
    R.zone = f < 0.55 ? 'top of the midfoot (instep)' : 'top of the forefoot'; put('b', f < 0.55 ? 'tarsals' : 'metatarsals'); put('s', 'ext_toe_t'); if (f < 0.6 && mo > 0) put('m', 'ext_dig_brevis'); if (f < 0.45 && mo < 0) put('s', 'tib_ant_t');
    put('nv', f > 0.6 && mo < -0.005 ? 'deep_peroneal_n' : 'superficial_peroneal_n'); R.derm = mo > 0.03 ? 'S1' : mo < -0.025 ? 'L4' : 'L5'; return;
  }
  if (sg * n[0] < 0) {
    R.asp = 'medial';
    if (f < 0.25) { R.zone = 'inner heel'; put('b', 'calcaneus'); put('s', 'tarsal_tunnel'); put('nv', 'tibial_n', 'plantar_n'); R.derm = 'S1'; }
    else if (f < 0.7) { R.zone = 'inner arch (medial midfoot)'; put('s', 'tib_post_t', 'spring_lig'); put('m', 'foot_intrinsics'); put('b', 'tarsals'); put('nv', 'saphenous_n'); R.derm = 'L4'; }
    else { R.zone = 'inner forefoot (big-toe joint / bunion area)'; put('s', 'mtp1'); put('b', 'metatarsals'); put('nv', 'saphenous_n'); R.derm = 'L5'; }
    return;
  }
  R.asp = 'lateral';
  R.zone = f < 0.3 ? 'outer heel' : f < 0.65 ? 'outer midfoot (5th metatarsal base)' : 'outer forefoot';
  put('b', f < 0.3 ? 'calcaneus' : 'metatarsals'); if (f < 0.5) put('s', 'peroneal_t'); put('nv', 'sural_n'); R.derm = 'S1';
}

// ---------------- genitals & perineum ----------------
function genitalZone(R, p, n, tag, P) {
  const put = R.put, part = tag.part, X = Math.abs(p[0]); R.seg = 'pelvic floor & genitals';
  if (part === 'penis') { const st = segT(p, tag.a, tag.b).t; const d = P.penis.dir; const up = nrm(cross([1, 0, 0], d)); const rv = sub(p, lerp3(tag.a, tag.b, st)); const dors = dot(rv, up) > 0.004 ? 'dorsal (upper) surface' : dot(rv, up) < -0.004 ? 'ventral (under) surface' : (p[0] > 0 ? 'left side' : 'right side'); R.zone = 'penile shaft, ' + (st < 0.25 ? 'base' : st > 0.75 ? 'near the head' : 'mid-shaft') + ', ' + dors; R.side = X < 0.006 ? 'midline' : R.side; put('s', 'penile_shaft'); put('m', 'bulbospongiosus'); put('nv', 'pudendal_n'); R.derm = st < 0.2 ? 'L1 / S2' : 'S2–S3'; put('visc', 'urethra'); return; }
  if (part === 'glans') { R.zone = 'glans (head of the penis)'; R.side = 'midline'; put('s', 'glans'); put('nv', 'pudendal_n'); R.derm = 'S2–S3'; put('visc', 'urethral opening (meatus)'); return; }
  if (part === 'testis') { R.zone = 'testicle (testis) and overlying scrotum' + (n[2] < -0.4 ? ', back (epididymis side)' : n[1] < -0.5 ? ', underside' : ''); put('s', 'testis', 'scrotum'); put('nv', 'iliohypo_n', 'genitofemoral_n', 'pudendal_n'); R.derm = n[2] > 0 ? 'L1 (front of scrotum)' : 'S3 (back of scrotum)'; put('visc', 'testis', 'epididymis'); return; }
  if (part === 'scrotum') { R.zone = 'upper scrotum / spermatic cord'; put('s', 'scrotum'); put('nv', 'genitofemoral_n', 'iliohypo_n'); R.derm = 'L1'; put('visc', 'spermatic cord (vas deferens, vessels)'); return; }
  if (part === 'mons') { R.zone = 'mons pubis (pubic mound)'; R.side = X < 0.012 ? 'midline' : R.side; put('s', 'mons'); put('b', 'pubis'); put('s', 'pubic_symph'); put('nv', 'iliohypo_n', 'genitofemoral_n'); R.derm = 'L1'; put('visc', 'bladder (behind the pubic bone)'); return; }
  if (part === 'labia_maj') { const V = P.vulva; const tt = segT(p, V.Pf, V.Pb).t; R.zone = 'labium majus (outer lip of the vulva), ' + (tt < 0.35 ? 'front part' : tt > 0.7 ? 'back part' : 'middle'); put('s', 'labia_maj'); put('m', 'bulbospongiosus'); put('nv', tt < 0.4 ? 'iliohypo_n' : 'pudendal_n', tt < 0.4 ? 'genitofemoral_n' : 'post_fem_cut_n'); R.derm = tt < 0.4 ? 'L1' : 'S3'; if (tt > 0.6) put('visc', 'Bartholin gland area'); return; }
  if (part === 'labia_min') { R.zone = 'labium minus (inner lip) / vestibule'; put('s', 'labia_min'); put('m', 'bulbospongiosus'); put('nv', 'pudendal_n'); R.derm = 'S3'; return; }
  if (part === 'clitoris') { R.zone = 'clitoris & clitoral hood'; R.side = 'midline'; put('s', 'clitoris'); put('m', 'bulbospongiosus'); put('nv', 'pudendal_n'); R.derm = 'S2–S3'; return; }
  if (part === 'vagina') { R.zone = 'vaginal opening (introitus)'; R.side = 'midline'; put('s', 'vagina_open', 'labia_min'); put('m', 'pelvic_floor', 'bulbospongiosus'); put('nv', 'pudendal_n'); R.derm = 'S3–S4'; put('visc', 'vagina', 'urethra (just in front)'); return; }
  if (part === 'anus') { R.zone = 'anus (back-passage opening)'; R.side = 'midline'; put('s', 'anus'); put('m', 'anal_sphincter', 'pelvic_floor'); put('nv', 'pudendal_n'); R.derm = 'S4–S5'; put('visc', 'anal canal', 'rectum'); return; }
  // perineal floor surface between legs
  const za = P.anus[2], dz = p[2] - za;
  if (Math.hypot(p[0], dz) < 0.018) { R.zone = 'perianal skin (around the anus)'; put('s', 'anus'); put('m', 'anal_sphincter', 'pelvic_floor'); put('nv', 'pudendal_n'); R.derm = 'S4–S5'; put('visc', 'anal canal'); return; }
  if (p[2] < za) { R.zone = 'natal cleft (crease between the buttocks), lower part'; put('s', 'gluteal_cleft'); put('b', 'coccyx'); put('m', 'glute_max', 'anal_sphincter'); put('nv', 'pudendal_n', 'cluneal_n'); R.derm = 'S4–S5'; return; }
  if (P.F && P.vulva && p[2] > P.vulva.Pb[2] - 0.005) { R.zone = X > 0.022 ? 'groin crease beside the vulva' : 'vulva (vestibule)'; put('s', X > 0.022 ? 'labia_maj' : 'labia_min'); put('m', 'bulbospongiosus'); put('nv', 'pudendal_n', 'post_fem_cut_n'); R.derm = 'S3'; return; }
  R.zone = 'perineum (area between the genitals and the anus)'; put('s', 'perineum'); put('m', 'pelvic_floor', 'bulbospongiosus'); if (X > 0.025) put('b', 'ischium'); put('nv', 'pudendal_n', 'post_fem_cut_n'); R.derm = 'S3–S4'; if (!P.F) put('visc', 'prostate (deep)', 'urethra (bulb)'); else put('visc', 'perineal body');
}

// ---------------- torso ----------------
function torsoZone(R, p, n, tag, P) {
  const put = R.put, X = Math.abs(p[0]), y = p[1], z = p[2], left = p[0] > 0;
  R.seg = 'trunk';
  const lvI = levelFromY(y), lv = LEVELS[lvI].name, lvG = LEVELS[lvI].g; R.lvl = lvI;
  const ant = n[2] > 0.35, post = n[2] < -0.35, topShoulder = n[1] > 0.6 && y > 1.38;
  if (tag.part === 'breast' || tag.part === 'nipple') {
    const cy = 1.258; R.seg = 'chest';
    if (tag.part === 'nipple') { R.zone = 'nipple & areola'; R.asp = 'anterior'; put('s', 'nipple', 'breast'); put('m', 'pec_major'); put('nv', 'intercostal_n'); R.derm = 'T4'; return; }
    if (n[1] < -0.45) { R.zone = 'underside of the breast / inframammary fold (crease under the breast)'; R.asp = 'inferior'; put('s', 'inframammary', 'breast', 'costochondral'); put('b', 'ribs'); put('m', 'pec_major', 'serratus_ant'); put('nv', 'intercostal_n'); R.derm = 'T5–T6'; if (left) put('visc', 'heart lies deep to the left lower breast — chest pain needs medical assessment'); return; }
    const q = (left ? 1 : -1) * (p[0] - (left ? 1 : -1) * 0.082);
    const quadr = (y > cy ? 'upper ' : 'lower ') + (q > 0 ? 'outer' : 'inner');
    R.zone = 'breast, ' + quadr + ' quadrant' + (quadr === 'upper outer' ? ' (toward the armpit, axillary tail)' : ''); R.asp = 'anterior'; put('s', 'breast'); put('m', 'pec_major'); if (q > 0.03) put('m', 'serratus_ant'); put('b', 'ribs'); put('nv', 'intercostal_n'); R.derm = antDerm(y); if (quadr === 'upper outer') put('visc', 'axillary lymph nodes nearby'); return;
  }
  // inframammary crease for female chest when on chest skin below breast
  if (P.F && ant && y > 1.17 && y < 1.215 && X > 0.03 && X < 0.14) { R.zone = 'inframammary fold (crease under the breast)'; R.asp = 'anterior'; put('s', 'inframammary', 'costochondral'); put('b', 'ribs'); put('m', 'pec_major', 'rectus_abd', 'ext_oblique'); put('nv', 'intercostal_n'); R.derm = 'T6'; return; }
  if (topShoulder) {
    R.asp = 'superior'; R.seg = 'shoulder';
    if (X > 0.15) { R.zone = 'top of the shoulder (acromion / AC joint)'; put('b', 'acromion', 'clavicle'); put('s', 'ac_joint', 'ac_lig', 'subacromial_bursa'); put('m', 'deltoid_mid', 'supraspinatus', 'upper_trap'); put('nv', 'suprascap_n', 'cervical_plexus'); R.derm = 'C4'; return; }
    R.zone = 'top of the shoulder between neck and shoulder (upper trapezius ridge)'; put('m', 'upper_trap', 'levator_scap', 'supraspinatus'); put('nv', 'spinal_accessory_n', 'cervical_plexus', 'dorsal_scap_n'); put('b', 'scapula', 'clavicle'); R.derm = 'C4'; return;
  }
  if (post) {
    R.asp = 'posterior';
    if (y >= 1.36) {
      if (X < 0.022) { R.zone = 'upper back, midline (spinous processes ' + lv + ')'; put('b', 'vert:' + lv); put('s', 'supraspinous_lig'); put('m', 'upper_trap', 'rhomboids'); put('nv', 'dorsal_rami'); }
      else if (X < 0.07) { R.zone = 'upper back between the spine and shoulder blade'; put('m', 'mid_trap', 'rhomboids', 'thor_erector'); if (y > 1.39) put('m', 'levator_scap'); put('b', 'vert:' + lv, 'ribs'); put('s', 'facet_joints'); put('nv', 'dorsal_scap_n', 'spinal_accessory_n', 'dorsal_rami'); }
      else if (y > 1.385) { R.zone = 'upper shoulder blade (supraspinous fossa)'; put('m', 'upper_trap', 'supraspinatus'); put('b', 'scapula'); if (X > 0.16) put('b', 'acromion'); put('nv', 'suprascap_n', 'spinal_accessory_n'); }
      else { R.zone = 'shoulder blade (infraspinous fossa)'; put('m', 'infraspinatus'); if (X > 0.13) put('m', 'teres_minor'); if (X > 0.16) put('m', 'deltoid_post'); put('b', 'scapula'); put('nv', 'suprascap_n'); }
      R.derm = postDerm(y); return;
    }
    if (y >= 1.2) {
      if (X < 0.022) { R.zone = 'mid-back, midline (thoracic spinous processes ' + lv + ')'; put('b', 'vert:' + lv); put('s', 'supraspinous_lig'); put('m', 'mid_trap', 'lower_trap'); put('nv', 'dorsal_rami'); }
      else if (X < 0.075) { R.zone = 'mid-back beside the spine (thoracic paraspinal region)'; put('m', 'thor_erector', 'multifidus'); if (y > 1.26) put('m', 'rhomboids'); put('m', y > 1.28 ? 'mid_trap' : 'lower_trap'); put('b', 'vert:' + lv, 'ribs'); put('s', 'facet_joints'); put('nv', 'dorsal_rami', 'root:' + lv); }
      else if (X < 0.15 && y > 1.24) { R.zone = 'lower shoulder blade (inferior angle region)'; put('m', 'infraspinatus', 'teres_major', 'lower_trap'); put('b', 'scapula'); put('nv', 'suprascap_n'); }
      else { R.zone = 'mid-back, outer (latissimus region)'; put('m', 'lats'); if (y > 1.25) put('m', 'teres_major'); put('b', 'ribs'); put('nv', 'thoracodorsal_n', 'intercostal_n'); }
      R.derm = postDerm(y); return;
    }
    if (y >= 1.10) {
      if (X < 0.022) { R.zone = 'lower thoracic spine, midline (' + lv + ')'; put('b', 'vert:' + lv); put('s', 'supraspinous_lig'); put('nv', 'dorsal_rami'); }
      else if (X < 0.08) { R.zone = 'lower mid-back beside the spine'; put('m', 'thor_erector', 'multifidus', 'lower_trap'); put('b', 'vert:' + lv, 'ribs'); put('s', 'facet_joints'); put('nv', 'dorsal_rami', 'root:' + lv); if (X > 0.035 && y < 1.16) put('visc', 'kidney (costovertebral angle) — flank pain with fever or urinary symptoms needs review'); }
      else { R.zone = 'lower rib cage, back (latissimus region)'; put('m', 'lats', 'ext_oblique'); put('b', 'ribs'); put('nv', 'intercostal_n'); }
      R.derm = postDerm(y); return;
    }
    if (y >= 0.985) {
      if (X < 0.02) { R.zone = 'lower back, midline (lumbar spinous processes ' + lv + ')'; put('b', 'vert:' + lv); put('s', 'supraspinous_lig'); put('m', 'multifidus'); put('nv', 'dorsal_rami'); }
      else if (X < 0.065) { R.zone = 'lower back beside the spine (lumbar paraspinal region)'; put('m', 'lumb_erector', 'multifidus'); put('s', 'thoracolumbar_fascia', 'facet_joints'); put('b', 'vert:' + lv); const nx = LEVELS[Math.min(lvI + 1, LEVELS.length - 1)].name; put('s', 'disc:' + lv + '-' + nx); put('nv', 'dorsal_rami', 'root:' + lv); }
      else if (X < 0.12) { R.zone = 'lower back, off-centre (quadratus lumborum region)'; put('m', 'ql', 'lumb_erector'); put('s', 'thoracolumbar_fascia'); if (y < 1.01) put('b', 'ilium'); put('nv', 'dorsal_rami', 'cluneal_n'); }
      else { R.zone = 'flank, back (posterolateral waist)'; put('m', 'ext_oblique', 'int_oblique', 'ql', 'lats'); if (y < 1.01) put('b', 'ilium'); put('nv', 'iliohypo_n', 'cluneal_n'); }
      R.derm = postDerm(y); return;
    }
    // sacral / gluteal
    if (y > 0.86 && X < 0.028) { R.zone = y < 0.89 ? 'tailbone region (coccyx) / top of the buttock crease' : 'sacrum (base of the spine)'; put('b', y < 0.89 ? 'coccyx' : 'sacrum'); put('m', 'multifidus', 'glute_max'); put('s', y < 0.89 ? 'gluteal_cleft' : 'supraspinous_lig'); put('nv', 'cluneal_n'); R.derm = y < 0.9 ? 'S4–S5' : 'S3'; return; }
    if (X < 0.022 && y <= 0.86) { R.zone = 'natal cleft (crease between the buttocks)'; put('s', 'gluteal_cleft'); put('m', 'glute_max'); put('b', 'coccyx'); put('nv', 'cluneal_n', 'pudendal_n'); R.derm = 'S4'; return; }
    if (X < 0.065 && y > 0.89) { R.zone = 'sacroiliac joint region (low-back dimple, PSIS)'; put('s', 'si_joint', 'si_lig'); put('b', 'psis', 'sacrum', 'ilium'); put('m', 'multifidus', 'glute_max'); put('nv', 'cluneal_n', 'dorsal_rami'); R.derm = 'S1–S2'; return; }
    if (y > 0.93 && X > 0.075) { R.zone = 'upper outer buttock (gluteus medius region)'; put('m', 'glute_med', 'glute_min', 'glute_max'); put('b', 'ilium'); put('nv', 'sup_gluteal_n', 'cluneal_n'); R.derm = 'L1–L3'; return; }
    if (y < 0.85 && X < 0.1) { R.zone = 'lower buttock / sit bone (ischial tuberosity)'; put('m', 'glute_max'); put('b', 'ischium'); put('s', 'hamstring_prox_t', 'sacrotuberous'); put('nv', 'post_fem_cut_n', 'sciatic_n', 'cluneal_n'); R.derm = 'S2–S3'; return; }
    if (X > 0.145) { R.zone = 'outer hip, back (greater trochanter region)'; put('b', 'greater_troch'); put('s', 'glute_med_t', 'troch_bursa', 'itb'); put('m', 'glute_med', 'glute_max'); put('nv', 'sup_gluteal_n'); R.derm = 'L2'; return; }
    R.zone = 'mid-buttock (gluteal region over the piriformis)'; put('m', 'glute_max', 'piriformis', 'deep_rotators'); put('nv', 'sciatic_n', 'inf_gluteal_n', 'cluneal_n'); put('s', 'si_lig'); R.derm = 'S2–S3'; return;
  }
  if (ant) {
    R.asp = 'anterior';
    if (y > 1.395) {
      if (X < 0.03) { R.zone = 'top of the breastbone (sternal notch / SC joints)'; put('b', 'sternum', 'clavicle'); put('s', 'sc_joint'); put('m', 'scm', 'pec_major'); put('nv', 'cervical_plexus'); R.derm = 'C4'; return; }
      R.zone = 'collarbone region (clavicle)'; put('b', 'clavicle'); put('m', 'pec_major', X > 0.15 ? 'deltoid_ant' : 'upper_trap'); if (X > 0.12 && X < 0.17 && y < 1.41) { put('b', 'coracoid'); put('m', 'pec_minor'); put('s', 'coracoclav'); } put('nv', 'cervical_plexus'); if (X > 0.07 && X < 0.15) put('nv', 'brachial_plexus'); R.derm = 'C4'; return;
    }
    if (y > 1.215) {
      if (X < 0.025) { R.zone = 'breastbone (sternum)'; put('b', 'sternum'); put('s', 'costochondral'); put('m', 'pec_major'); put('nv', 'intercostal_n'); put('visc', 'heart & great vessels (deep) — chest pain needs medical assessment'); R.derm = antDerm(y); return; }
      if (X < 0.06) { R.zone = 'beside the breastbone (costochondral junctions)'; put('s', 'costochondral', 'costal_cart'); put('b', 'ribs', 'sternum'); put('m', 'pec_major', 'intercostals'); put('nv', 'intercostal_n'); if (left) put('visc', 'heart (deep, left of the breastbone)'); R.derm = antDerm(y); return; }
      if (X > 0.13 && y > 1.31) { R.zone = 'front of the shoulder / chest junction (deltopectoral area)'; put('m', 'pec_major', 'deltoid_ant', 'pec_minor'); put('b', 'coracoid'); put('nv', 'brachial_plexus'); R.derm = 'T2'; return; }
      R.zone = 'chest (pectoral region)'; put('m', 'pec_major'); if (X > 0.08 && y > 1.29) put('m', 'pec_minor'); put('m', 'intercostals'); put('b', 'ribs'); put('nv', 'intercostal_n'); put('visc', left ? 'heart & left lung (deep)' : 'right lung (deep)'); R.derm = antDerm(y); return;
    }
    if (y > 1.12) {
      if (X < 0.03) { R.zone = 'epigastrium (upper central abdomen, below the breastbone)'; put('b', 'xiphoid'); put('m', 'rectus_abd', 'diaphragm'); put('nv', 'intercostal_n'); put('visc', 'stomach', 'pancreas (deep)', 'heart (above)'); R.derm = antDerm(y); return; }
      R.zone = (left ? 'left' : 'right') + ' upper abdomen below the ribs (hypochondrium / costal margin)'; put('m', 'rectus_abd', 'ext_oblique', 'diaphragm'); put('s', 'costal_cart'); put('b', 'ribs'); put('nv', 'intercostal_n'); put('visc', left ? 'stomach, spleen' : 'liver, gallbladder'); R.derm = antDerm(y); return;
    }
    if (y > 0.99) {
      if (X < 0.03) { R.zone = 'umbilical region (around the navel)'; put('m', 'rectus_abd'); put('nv', 'intercostal_n'); put('visc', 'small intestine', 'aorta (deep)'); R.derm = antDerm(y); return; }
      if (X < 0.085) { R.zone = 'abdomen beside the navel (rectus region)'; put('m', 'rectus_abd'); put('nv', 'intercostal_n'); put('visc', left ? 'small intestine, descending colon' : 'small intestine, ascending colon'); R.derm = antDerm(y); return; }
      R.zone = 'side of the abdomen (lumbar / flank region)'; put('m', 'ext_oblique', 'int_oblique', 'transversus'); put('nv', 'intercostal_n', 'iliohypo_n'); put('visc', left ? 'descending colon' : 'ascending colon', 'kidney (deep, behind)'); R.derm = antDerm(y); return;
    }
    if (y > 0.885) {
      if (X < 0.04) { R.zone = 'suprapubic region (low central abdomen above the pubic bone)'; put('m', 'rectus_abd'); if (y < 0.905) put('b', 'pubis'); put('nv', 'iliohypo_n'); put('visc', 'bladder', P.F ? 'uterus' : 'prostate (deep, below)'); R.derm = antDerm(y); return; }
      if (X > 0.11 && y > 0.935) { R.zone = 'front hip point (ASIS)'; put('b', 'asis', 'ilium'); put('m', 'sartorius', 'tfl', 'iliopsoas'); put('s', 'inguinal_lig'); put('nv', 'lfcn', 'iliohypo_n'); R.derm = 'T12–L1'; return; }
      if (y < 0.935 && X > 0.05) { R.zone = 'inguinal region (groin crease)'; put('s', 'inguinal_lig'); put('m', 'iliopsoas', 'int_oblique'); put('nv', 'iliohypo_n', 'genitofemoral_n', 'femoral_n'); put('visc', 'inguinal canal (hernia site)', 'lymph nodes'); R.derm = 'L1'; return; }
      R.zone = (left ? 'left' : 'right') + ' lower abdomen (iliac fossa)'; put('m', 'rectus_abd', 'ext_oblique', 'int_oblique', 'iliopsoas'); put('nv', 'iliohypo_n'); put('visc', left ? 'sigmoid colon' : 'appendix & caecum', P.F ? (left ? 'left ovary' : 'right ovary') : ''); R.visc = R.visc.filter(Boolean); R.derm = antDerm(y); return;
    }
    if (X < 0.05) { R.zone = 'pubic region / base of the genitals'; put('b', 'pubis'); put('s', 'pubic_symph'); put('m', 'adductors'); put('nv', 'iliohypo_n', 'genitofemoral_n'); R.derm = 'L1'; return; }
    R.zone = 'groin / front of the hip (femoral triangle)'; put('s', 'femoral_triangle', 'hip_joint', 'iliofemoral', 'hip_labrum'); put('m', 'iliopsoas', 'pectineus', 'rectus_fem', 'sartorius'); put('nv', 'femoral_n', 'genitofemoral_n'); put('visc', 'femoral artery & vein', 'inguinal lymph nodes'); R.derm = 'L1–L2'; return;
  }
  // lateral trunk
  R.asp = 'lateral';
  if (y > 1.30) { R.zone = 'side of the chest below the armpit'; put('m', 'serratus_ant', 'lats', 'pec_major'); put('b', 'ribs'); put('nv', 'long_thoracic_n', 'intercostal_n'); put('visc', 'axillary lymph nodes'); R.derm = 'T3'; return; }
  if (y > 1.10) { R.zone = 'side of the rib cage (lateral chest wall)'; put('m', 'serratus_ant', 'lats', 'intercostals', 'ext_oblique'); put('b', 'ribs'); put('nv', 'intercostal_n', 'long_thoracic_n'); put('visc', left ? 'spleen (lower left ribs)' : 'liver (lower right ribs)'); R.derm = antDerm(y); return; }
  if (y > 0.975) { R.zone = 'flank (side of the waist)'; put('m', 'ext_oblique', 'int_oblique', 'transversus', 'ql'); put('nv', 'intercostal_n', 'iliohypo_n'); put('visc', 'kidney (deep, toward the back)'); R.derm = y > 1.03 ? 'T10–T11' : 'T12'; return; }
  if (y > 0.86) { R.zone = 'side of the hip (iliac crest to greater trochanter)'; put('m', 'glute_med', 'tfl'); put('b', y > 0.95 ? 'ilium' : 'greater_troch'); put('s', y < 0.92 ? 'glute_med_t' : 'thoracolumbar_fascia', y < 0.92 ? 'troch_bursa' : 'itb'); put('nv', 'sup_gluteal_n', 'iliohypo_n'); R.derm = 'L1–L2'; return; }
  R.zone = 'outer hip / upper outer thigh'; put('b', 'greater_troch'); put('s', 'itb', 'troch_bursa'); put('m', 'tfl', 'vastus_lat'); put('nv', 'lfcn'); R.derm = 'L2';
}
