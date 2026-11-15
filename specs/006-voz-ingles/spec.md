# Feature Specification: English voice check-in

**Feature Branch**: `006-voz-en` · **Created**: 2026-11-15 · **Status**: Implemented
**Input**: User request: "que hable y escuche en inglés" — Vita must speak and understand English when
the user picks EN in the ES | EN toggle (feature 001 + D54 made only the screen bilingual).

## User Scenarios & Testing

### User Story 1 — Check-in fully in English (P1)
With EN selected, Vita speaks every line in English with a local English voice, listens with an
English model, and understands English answers (numbers, yes/no, mood words, symptoms, pause/resume/
repeat). With ES selected, everything behaves exactly as today.

**Acceptance**
1. Given EN, when the check-in starts, then the first line is spoken in English (same text as the caption).
2. Given EN, when the user says "seven and a half" at the sleep step, then 7.5 hours is proposed; "yes"
   confirms it.
3. Given EN, "very good"/"good"/"okay"/"bad"/"very bad" or "one".."five" set mood 5..1 / 1..5;
   "dizziness", "fainting", "chest pain", "shortness of breath", "none"/"no" set symptoms; "stop",
   "continue", "repeat" pause, resume and repeat.
4. Given ES, the Spanish voice, model, grammar and parser are used, unchanged.
5. Given the language is switched while a check-in is running, the running check-in keeps its language;
   the next one uses the new language.
6. Given EN and no local English voice, the check-in continues with captions only (same rule as Spanish).
7. Given EN, the answer chips send English words that the English parser understands.

### Edge cases
- English model fails to load → same "model unavailable" path as today (chips only).
- Numbers: English digits "7.5" accepted; "7,5" only in Spanish.

## Requirements
- **FR-001** Voice language = UI locale (`config/i18n.ts`) read when a check-in starts; fixed until it ends.
- **FR-002** Spoken lines come from the catalog of that language (`messages.en.ts` / `messages.es.ts`);
  spoken numbers use that language's format.
- **FR-003** TTS picks only local voices of that language (EN preferred `en-us`, `en-gb`); none → silent, captions.
- **FR-004** Recognition loads the model of that language: ES `/models/vosk/parts/manifest.json`,
  EN `/models/vosk/en/manifest.json` (`vosk-model-small-en-us-0.15`, Apache 2.0); each model is loaded
  once and kept; both are precached for offline use.
- **FR-005** Each listening step has an English grammar with the words of FR-006 plus `[unk]`.
- **FR-006** The domain parser takes the language and reads English numbers 0–24 ("zero".."twenty-four",
  "and a half", "half"), yes/no, mood words, symptom phrases, control words; it stays pure.
- **FR-007** Backend, contracts and stored data are unchanged (keys, not text).

## Success Criteria
- **SC-001** An EN check-in can be completed by voice end to end with no Spanish spoken or required.
- **SC-002** All existing Spanish tests pass unchanged in behaviour.
