# Contract: 3D body asset (`frontend/public/models/body.glb`)

Source of truth: `base-vital-voice-blender-integration-spec.md` §3. Node names are the API; renaming
any of them breaks the viewer.

| Node | Type | Placement (≈2 mm off the skin, along the normal) | Sensor (RF6) |
|---|---|---|---|
| `body` | single joined Mesh, material `skin_pearl` (`#D9DDE2`, roughness 0.6) | whole figure | — |
| `sensor_sleep` | Empty | center of forehead | sueño |
| `sensor_pulse` | Empty | left chest, over the heart | pulso |
| `sensor_pressure` | Empty | right upper arm, mid-biceps | presión |
| `sensor_temperature` | Empty | navel (abdomen) | temperatura |
| `sensor_oxygen` | Empty | tip of right index finger | oxígeno |
| `camera_default` | Camera (optional) | front, slight 3/4 | — |

Export: glTF Binary, +Y up, modifiers and transforms applied, Draco level 6, no animation.

Checked by `frontend/scripts/check-model.ts` (fails the build):
- all 5 `sensor_*` nodes and `body` exist;
- triangles ≤ 30 000;
- file ≤ 3 MB;
- every sensor node ≤ 3 cm from the `body` surface.

Produced by `frontend/scripts/blender/create_sensor_empties.py` (run with `blender --background src.blend
--python ...`), which creates the empties at given coordinates, joins the mesh, applies transforms
and exports.

Fallback (CL5): `frontend/public/models/body-fallback.png`, rendered from the same camera, with the 5 dot
positions in `frontend/src/config/constants.ts` (`FALLBACK_DOTS`, percentages of width/height).
