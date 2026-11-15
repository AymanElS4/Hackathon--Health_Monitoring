# Contract: Daily check-in script (`frontend/src/config/checkinScripts.ts`)

The script is data; the reducer executes it. Spanish text lives only in `messages.es.ts`.
Only the `daily` script exists in this feature.

| Step | Message key (example text) | Grammar | 3D focus | Result |
|---|---|---|---|---|
| greeting | `greet` ("Buenos días, Ana. Chequeo diario.") | — | — | — |
| ask_sleep | `ask.sleep` ("¿Cuántas horas dormiste?") | numbers 0–24, "y media", control | `sleep` | `sleep_hours` |
| confirm_sleep | `confirm.sleep` ("Escuché que dormiste {hours} horas. ¿Es correcto?") | sí / no, control | `sleep` | confirmed or re-ask |
| ask_mood | `ask.mood` ("Del uno al cinco, ¿cómo te sientes?") | 1–5, mood words, control | `sleep` | `mood` |
| confirm_mood | `confirm.mood` ("Escuché que tu ánimo es {mood} de 5. ¿Es correcto?") | sí / no, control | `sleep` | confirmed or re-ask |
| ask_symptoms | `ask.symptoms` ("¿Tienes algún síntoma?") | mareo, desmayo, dolor de pecho, falta de aire, no / ninguno, control | — | `Symptom[]` |
| measuring | `measure` ("Ahora tomo tus signos.") | — | `pressure` → `pulse` → `oxygen` → `temperature`, 1 s each | device observations |
| summary | `verdict.*` + one `action.*` | — | worst sensor | verdict + action |
| next_activity | `next` ("Lo próximo: {title} a las {time}.") | sí, repite | — | record saved |

Control words in every listening step: `para` (pause), `sigue` (resume), `repite` (repeat).

Rules bound to the script:
- RN4: sleep > 16 or mood outside 1–5 → `retry.*` message, same step again.
- CL1 / RF12: 2 failed recognitions in a step → big buttons for that step's options.
- Principle VI: no `verdict.*` or `action.*` text may name a disease or medication; it describes the
  reading and one everyday action (e.g., "Dormiste poco: tómalo con calma").
- Ánimo uses the team-criterion label (Principle VIII): the metric card shows "criterio del equipo".
