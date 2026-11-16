# PainMap 3D

A 3D body pain map for Windows and Android (any modern browser). Mark areas, spreading paths and pinpoint spots of pain on a male or female body, explore anatomy layers, and generate a detailed, anatomy-aware description to give a clinician or an AI assistant.

Published (private) link: https://claude.ai/artifact/VMX35i2escjmzfJVAYui8y

## Files

| Path | What it is |
|---|---|
| `src/page.html` | Page layout and styles |
| `src/a_body.js` | Procedural male/female body (signed-distance shapes, posed with legs apart) |
| `src/b_db.js` | Anatomy database: names with plain-English glosses, functions, pain relevance |
| `src/c_classify.js` | Maps every skin point to region, side, muscles, bones, nerves, dermatome |
| `src/d_structures.js` | Hand-made schematic nerves, joint ligaments, menisci, tendons |
| `src/x_atlas_parts.js` | Sorts BodyParts3D parts into layers and links them to the anatomy database |
| `src/x_atlas_fit.js` | Re-poses the atlas from anatomical position to the app pose and fits it inside each body |
| `src/x_precompute.js` | Packs everything into `data/body-<sex>.bin` |
| `src/g_loader.js`, `src/e_app.js`, `src/f_prompt.js` | Runtime: loading, painting/marking UI, inspector, prompt writer |
| `tools/atlas_prepare.mjs` | Reads the atlas OBJ files, simplifies them into `atlas/cache/` |
| `tools/precompute.mjs` | Builds the body data files (run by `build.py`) |
| `build.py` | Builds `painmap-3d.html` (web) and `painmap-3d-offline.html` (single file, data embedded) |

## Releases

Each release is a whole number (v1, v2, v3…), tagged in git with the same name. Its build files are saved locally in `!Releases\v<N>\` (offline file, web page, model data, checksums); git keeps only the release notes and checksums. A released version is never changed: any later change becomes the next version.

## Build

Requires Node.js and Python 3.

```
cd tools && npm install && cd ..
node tools/atlas_prepare.mjs     # only after (re)downloading the atlas, see below
python build.py                  # precomputes data/ and writes both HTML files
```

`python build.py --skip-data` rebuilds the HTML only.

## Anatomy atlas (not in git)

From https://dbarchive.biosciencedbc.jp/data/bodyparts3d/LATEST/ download `isa_BP3D_4.0_obj_99.zip`, `isa_parts_list_e.txt` and `isa_element_parts.txt` into `atlas/raw_isa/`, then unzip the archive into `atlas/obj_isa/`.

Bones, muscles, cartilage, organs and major blood vessels: **BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International.** Re-posed and simplified for this app.

Nerves (outside the eye socket), joint ligaments, menisci and the paintable body surface are simplified hand-made models.

## Not medical advice

This tool helps describe pain clearly. It does not diagnose. Anatomy is estimated from where marks sit on a standard body.
