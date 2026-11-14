"""Build PainMap 3D.

1. node tools/precompute.mjs   -> data/body-male.bin, data/body-female.bin (precomputed models, gzip)
2. python build.py             -> painmap-3d.html          (web version: loads body-*.bin next to it)
                                  painmap-3d-offline.html  (single file for Windows/Android, data embedded)
"""
import base64, pathlib, subprocess, sys
root = pathlib.Path(__file__).parent
src = root / 'src'
if '--skip-data' not in sys.argv:
    subprocess.run(['node', str(root / 'tools' / 'precompute.mjs')], check=True)
js = "import * as THREE from 'three';\nimport { OrbitControls } from 'three/addons/controls/OrbitControls.js';\nimport { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';\n"
for name in ['a_body.js', 'b_db.js', 'c_classify.js', 'd_structures.js', 'g_loader.js', 'f_prompt.js', 'e_app.js']:
    js += f"\n// ---- {name} ----\n" + (src / name).read_text(encoding='utf-8')
page = (src / 'page.html').read_text(encoding='utf-8').replace('/*APP_JS*/', js)
(root / 'painmap-3d.html').write_text(page, encoding='utf-8')
for sex in ['male', 'female']:  # web version data files (base64 text; the artifact host serves text, not raw binary)
    (root / 'data' / f'body-{sex}.txt').write_text(base64.b64encode((root / 'data' / f'body-{sex}.bin').read_bytes()).decode(), encoding='ascii')
embedded = ''.join(
    f'<script type="text/plain" id="data-body-{sex}">{base64.b64encode((root / "data" / f"body-{sex}.bin").read_bytes()).decode()}</script>\n'
    for sex in ['male', 'female'])
full = ('<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n'
        '<style>:root{padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}body{margin:0}[hidden]{display:none!important}</style>\n'
        '</head>\n<body>\n' + embedded + page + '\n</body>\n</html>\n')
(root / 'painmap-3d-offline.html').write_text(full, encoding='utf-8')
print('web page', len(page) // 1024, 'KB; offline file', len(full) // 1024, 'KB')
