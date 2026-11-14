// ===================== BodyParts3D atlas: layer + anatomy-id mapping (build-time) =====================
// BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.
const ORGAN_RX = /gyrus|lobule|lobe of|ventricle|colliculus|thalam|brain|cerebel|pons|medulla|hippocamp|caudate nucleus|commissure|fornix|internal capsule|corpus callosum|white matter|putamen|globus|amygdala|habenula|pineal|pituitary|tuber cinereum|mammillary|stria|septum of|lamina terminalis|geniculate body|choroid|cornea|iris|lens|sclera|vitreous|retina|chamber of|corona ciliaris|atrium|valve|leaflet|papillary|colon|ileum|jejunum|duodenum|stomach|esophagus|rectum$|appendix|ileocecal|taenia|mesentery|mesocolon|mesoappendix|liver|caudate lobe|pancrea|kidney|adrenal|spleen|gallbladder|bladder|ureter|urethra|prostate|testis|epididymis|seminal|deferent|corpus cavernosum|corpus spongiosum|glans penis|thymus|trachea|bronch|tongue|gingiva|^lip$|eyebrow|hair|external ear|lacrimal (gland|canaliculus|sac|lake)|nasolacrimal|salivary|sublingual gland|submandibular gland|tarsal plate|tentorium|\bduct\b|aqueduct|foramen|interpeduncular|optic part|central canal|hepatovenous|biliary|peduncle|wall of|cavity of|brachium of|choroid plexus|fourth ventricle|third ventricle/;
const VESSEL_RX = /arter|vein|aorta|vena|venous|sinus|celiac|trunk of|portal|pulmonary trunk|palmar arch|plantar arch|perforating|branch of|ramus/;
const MAJOR_VESSEL_RX = /^(abdominal aorta|ascending aorta|arch of aorta|descending thoracic aorta|descending aorta|inferior vena cava|superior vena cava|(left|right) (common carotid artery|internal jugular vein|subclavian artery|subclavian vein|axillary artery|axillary vein|brachial artery|radial artery|ulnar artery|common iliac artery|common iliac vein|external iliac artery|external iliac vein|femoral artery|femoral vein|popliteal artery|popliteal vein|anterior tibial artery|posterior tibial artery|great saphenous vein|small saphenous vein|cephalic vein|basilic vein|vertebral artery|internal carotid artery|brachiocephalic vein)|brachiocephalic artery|pulmonary trunk)$/;
function atlasLayer(name) {
  const n = name.toLowerCase().trim();
  if (!n) return null;
  if (n === 'skin') return 'skin';
  if (/insula|occipital lobe/.test(n)) return 'organ';
  if (/suspensory ligament of lens/.test(n)) return 'organ';
  if (/costocervical trunk|thyrocervical trunk/.test(n)) return null;
  if (/^(external ear|eyebrow|hair of head|pubic hair|lip|gingiva)/.test(n)) return null; // surface features: the app's own body surface covers these
  if (/nerve|ganglion|optic chiasm|optic tract/.test(n)) return 'nerve';
  if (/intervertebral dis|cartilage|epiglottis/.test(n)) return 'cartilage';
  if (/tendon|iliotibial tract|linea alba|tendinous|raphe/.test(n)) return 'tendon';
  if (/ligament|membrane|retinaculum|conus elasticus/.test(n)) return 'ligament';
  if (MAJOR_VESSEL_RX.test(n)) return 'vessel';
  if (VESSEL_RX.test(n)) return null; // minor vessels dropped
  // whole words only: "tibialis", "fibularis", "carpi ulnaris", "subscapularis", "levator scapulae" are muscles
  if (/\b(bone|vertebra|rib|sternum|manubrium|xiphoid process|clavicle|scapula|humerus|radius|ulna|femur|patella|tibia|fibula|phalanx|sacrum|coccyx|mandible|maxilla|sesamoid|tooth|calcaneus|talus|scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate|ethmoid|vomer|concha)\b|metacarpal bone|metatarsal bone|cuboid bone|cuneiform bone|navicular bone|^atlas$|^axis$/.test(n)) return 'bone';
  if (ORGAN_RX.test(n)) return 'organ';
  return 'muscle';
}
const ORD = { first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12 };
const VERT_G = { cervical: 'C', thoracic: 'T', lumbar: 'L' };
function nextLevel(name) { const i = LEVELS.findIndex(l => l.name === name); return LEVELS[i + 1] ? LEVELS[i + 1].name : null; }
// map a BodyParts3D name (side removed, lower case) to an id used by the app's anatomy database
const ATLAS_MAP = [
  [/acromial part of deltoid/, 'deltoid_mid'], [/clavicular part of deltoid/, 'deltoid_ant'], [/spinal part of deltoid/, 'deltoid_post'],
  [/descending part of trapezius/, 'upper_trap'], [/transverse part of trapezius/, 'mid_trap'], [/ascending part of trapezius/, 'lower_trap'],
  [/biceps brachii/, 'biceps'], [/triceps brachii/, 'triceps'], [/anconeus/, 'anconeus'], [/brachioradialis/, 'brachioradialis'], [/brachialis/, 'brachialis'], [/coracobrachialis/, 'coracobrachialis'],
  [/supraspinatus/, 'supraspinatus'], [/infraspinatus/, 'infraspinatus'], [/teres minor/, 'teres_minor'], [/teres major/, 'teres_major'], [/subscapularis/, 'subscapularis'],
  [/pectoralis major/, 'pec_major'], [/pectoralis minor/, 'pec_minor'], [/serratus anterior/, 'serratus_ant'], [/serratus posterior/, 'serratus_post'], [/subclavius/, 'subclavius'],
  [/rhomboid/, 'rhomboids'], [/levator scapulae/, 'levator_scap'], [/sternocleidomastoid/, 'scm'], [/scalenus/, 'scalenes'], [/splenius/, 'splenius'], [/platysma/, 'platysma'],
  [/rectus capitis posterior|obliquus capitis/, 'suboccipitals'], [/longus colli|longus capitis|rectus capitis anterior|rectus capitis lateralis/, 'deep_neck_flexors'],
  [/semispinalis (capitis|cervicis)|longissimus (capitis|cervicis)|iliocostalis cervicis|cervical rotator|interspinales cervicis|cervical intertransversarii/, 'cerv_paraspinals'],
  [/lumborum|lumbar rotator|lumbar intertransversarius|interspinales lumborum/, 'lumb_erector'],
  [/semispinalis thoracis|longissimus thoracis|iliocostalis thoracis|spinalis|thoracic rotator|interspinalis thoracis/, 'thor_erector'],
  [/levatores costarum|intercostal|transversus thoracis/, 'intercostals'], [/diaphragm/, 'diaphragm'], [/external oblique/, 'ext_oblique'],
  [/psoas|iliacus/, 'iliopsoas'], [/gluteus maximus/, 'glute_max'], [/gluteus medius/, 'glute_med'], [/gluteus minimus/, 'glute_min'], [/piriformis/, 'piriformis'],
  [/gemellus|obturator|quadratus femoris/, 'deep_rotators'], [/tensor fasciae latae/, 'tfl'], [/adductor (longus|brevis|magnus|minimus)/, 'adductors'], [/gracilis/, 'gracilis'], [/sartorius/, 'sartorius'], [/pectineus/, 'pectineus'],
  [/rectus femoris/, 'rectus_fem'], [/vastus lateralis/, 'vastus_lat'], [/vastus medialis/, 'vastus_med'], [/vastus intermedius/, 'vastus_int'],
  [/biceps femoris/, 'biceps_fem'], [/semitendinosus|semimembranosus/, 'semi_tend_memb'], [/gastrocnemius/, 'gastrocnemius'], [/soleus/, 'soleus'], [/plantaris/, 'plantaris'], [/popliteus/, 'popliteus'],
  [/tibialis anterior/, 'tib_ant'], [/tibialis posterior/, 'tib_post'], [/fibularis/, 'peroneals'], [/extensor digitorum longus|extensor hallucis longus/, 'ext_dig_l'], [/flexor digitorum longus|flexor hallucis longus/, 'flex_dig_l'],
  [/extensor hallucis brevis|extensor digitorum brevis/, 'ext_dig_brevis'],
  [/abductor hallucis|flexor digitorum brevis|flexor accessorius|of foot|adductor hallucis|flexor hallucis brevis/, 'foot_intrinsics'],
  [/pronator teres/, 'pronator_teres'], [/pronator quadratus/, 'pronator_quadratus'], [/supinator/, 'supinator'], [/flexor carpi ulnaris/, 'fcu'],
  [/flexor carpi radialis|palmaris longus|flexor digitorum (superficialis|profundus)|flexor pollicis longus/, 'wrist_flex'],
  [/extensor carpi|extensor digitorum|extensor digiti minimi|extensor indicis/, 'wrist_ext'], [/abductor pollicis longus|extensor pollicis/, 'thumb_abd'],
  [/abductor pollicis brevis|flexor pollicis brevis|opponens pollicis|adductor pollicis/, 'thenar'], [/digiti minimi.*hand/, 'hypothenar'], [/lumbricals of hand|interossei of hand/, 'hand_intrinsics'],
  [/coccygeus|iliococcygeus|pubococcygeus|puborectalis|tendinous arch of levator ani/, 'pelvic_floor'], [/external anal sphincter/, 'anal_sphincter'],
  [/digastric|mylohyoid|geniohyoid|stylohyoid$|sternohyoid|sternothyroid|thyrohyoid$|omohyoid|intermediate tendon/, 'hyoid_muscles'],
  [/constrictor|pharyng|arytenoid|crico|vocalis|veli palatini|uvular|epiglottic|glossus|raphe/, 'throat_muscles'],
  [/rectus$|oblique$|levator palpebrae|common tendinous ring|check ligament|trochlea of superior oblique/, 'eye_muscles'],
  [/calcaneal tendon/, 'achilles'], [/iliotibial tract/, 'itb'], [/linea alba/, 'linea_alba'], [/flexor retinaculum/, 'flexor_retinac'], [/long plantar ligament/, 'spring_lig'], [/interosseous membrane/, 'interosseous_mem'],
  [/thyrohyoid membrane|thyrohyoid ligament|cricothyroid ligament|vocal ligament|conus elasticus|stylohyoid ligament|hyo-epiglottic|thyro-epiglottic/, 'thyroid_cart'],
  [/costal cartilage/, 'costal_cart'], [/thyroid cartilage|cricoid|arytenoid cartilage|corniculate|cuneiform cartilage|epiglottis/, 'thyroid_cart'], [/nasal cartilage|alar cartilage/, 'nasal_cart'],
  [/\bhumerus\b/, 'humerus'], [/\bradius\b/, 'radius'], [/\bulna\b/, 'ulna'], [/\bfemur\b/, 'femur'], [/\bpatella\b/, 'patella'], [/\btibia\b/, 'tibia'], [/\bfibula\b/, 'fibula'], [/\bclavicle\b/, 'clavicle'], [/\bscapula\b/, 'scapula'],
  [/body of sternum|manubrium/, 'sternum'], [/xiphoid/, 'xiphoid'], [/\brib\b/, 'ribs'], [/sacrum/, 'sacrum'], [/coccyx/, 'coccyx'], [/hip bone/, 'ilium'],
  [/scaphoid|lunate|triquetral|pisiform|trapezium|trapezoid|capitate|hamate/, 'carpals'], [/metacarpal/, 'metacarpals'], [/metatarsal/, 'metatarsals'], [/sesamoid/, 'metatarsals'],
  [/phalanx of .*(finger|thumb)/, 'phalanges_h'], [/phalanx of .*toe/, 'phalanges_f'], [/navicular|cuboid|cuneiform bone/, 'tarsals'], [/talus/, 'talus'], [/calcaneus/, 'calcaneus'],
  [/occipital bone/, 'occipital_bone'], [/frontal bone|parietal bone|temporal bone|sphenoid|ethmoid/, 'skull'], [/maxilla|zygomatic|nasal bone|lacrimal bone|palatine|vomer|concha/, 'facial_bones'], [/mandible/, 'mandible'], [/hyoid bone/, 'hyoid'], [/tooth/, 'teeth'],
  [/optic nerve|optic chiasm|optic tract/, 'optic_n'], [/nerve|ganglion/, 'eye_nerves'],
];
function atlasId(name, layer) {
  const n = name.toLowerCase().replace(/\b(left|right)\b ?/g, '').replace(/ (of )?(left|right)\b/g, '').trim();
  let m = n.match(/^(first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra$/);
  if (m) return 'vert:' + VERT_G[m[2]] + ORD[m[1]];
  if (n === 'atlas') return 'vert:C1'; if (n === 'axis') return 'vert:C2';
  m = n.match(/^intervertebral disk of (first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|eleventh|twelfth) (cervical|thoracic|lumbar) vertebra$/);
  if (m) { const a = VERT_G[m[2]] + ORD[m[1]]; return 'disc:' + a + '-' + nextLevel(a); }
  if (n === 'intervertebral disk of axis') return 'disc:C2-C3';
  if (n === 'intervertebral disk') return 'disc';
  for (const [rx, id] of ATLAS_MAP) if (rx.test(n)) return id;
  if (layer === 'organ') return organId(n);
  if (layer === 'vessel') return /vein|vena/.test(n) ? 'major_veins' : 'major_arteries';
  return 'bp:' + n; // unmapped: described from its atlas name
}
function organId(n) {
  const T = [[/atrium|ventricle of|valve|leaflet|cusp|papillary|wall of/, 'heart'], [/liver|caudate lobe|biliary|hepatic duct|cystic duct|common hepatic/, 'liver'], [/gallbladder/, 'gallbladder'], [/stomach/, 'stomach_o'], [/esophagus/, 'esophagus'],
    [/duodenum|jejunum|ileum|mesentery of small/, 'small_intestine'], [/colon|cecal|ileocecal|appendix|mesoappendix|taenia|mesocolon|rectum/, 'large_intestine'], [/pancrea/, 'pancreas'], [/spleen/, 'spleen'],
    [/kidney|adrenal/, 'kidney'], [/ureter/, 'ureter'], [/bladder/, 'bladder'], [/urethra/, 'urethra_o'], [/prostate/, 'prostate'], [/testis|epididymis|seminal|deferent|corpus cavernosum|corpus spongiosum|glans/, 'male_repro'],
    [/trachea|bronch/, 'airway'], [/thymus/, 'thymus'], [/tongue/, 'tongue'], [/cornea|iris|lens|sclera|vitreous|retina|chamber of|choroid$|corona ciliaris|lacrimal|tarsal plate|nasolacrimal/, 'eye'], [/gland/, 'glands']];
  for (const [rx, id] of T) if (rx.test(n)) return id;
  return 'brain';
}
