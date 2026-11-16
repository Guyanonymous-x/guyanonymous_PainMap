# PainMap 3D — v1

Released 2026-11-16. Git tag `v1`. Published as version 6 of the private link https://claude.ai/artifact/VMX35i2escjmzfJVAYui8y.

This release is closed. Any further change is a new version.

## Files in this folder

| File | Use |
|---|---|
| `painmap-3d-offline.html` | Single file with both body models built in. Copy to a Windows PC or Android device and open in a browser (internet needed only for the 3D display library). |
| `painmap-3d.html` | Web version, as published. Needs `body-male.txt` and `body-female.txt` beside it. |
| `body-male.txt`, `body-female.txt` | Precomputed body models and anatomy layers (gzip, base64). |
| `SHA256SUMS.txt` | Checksums to confirm the files are unchanged. |

## What v1 does

- Male and female 3D bodies in a relaxed T-pose, legs spread and buttocks parted; anatomically complete, clinical (not photorealistic); detailed face, hands, feet and pelvic floor; zoom presets.
- Mark pain as areas, spreading paths (START/END tags, direction arrows) and pinpoint spots, in 11 pain types; erase areas, points and parts of paths; undo.
- Anatomy layers from the BodyParts3D atlas (bones, muscles, cartilage, organs, major vessels), plus schematic hand-made nerves, joint ligaments, menisci and tendons; skin, dermatome map and muscle map views.
- Hover/tap inspector naming every structure under the pointer, with plain-English explanations, function and pain relevance. Left/right is always the patient's own.
- Natural-language prompt for a clinician or an AI (self-care, possible causes, or full assessment), with anatomy, dermatomes and pattern notes.
- Models load from precomputed files (well under a second on a PC).

## Credits

Bones, muscles, cartilage, organs and major blood vessels: BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0 International. Re-posed and simplified for this app.
