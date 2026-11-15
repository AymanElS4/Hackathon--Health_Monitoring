# Tasks — 006 English voice check-in

- [X] T001 Download `vosk-model-small-en-us-0.15`, repack as tar.gz, split into `frontend/public/models/vosk/en/` (main session, internet)
- [X] T002 Test-first: English number parser `frontend/src/domain/parsing/englishNumbers.ts` + tests
- [X] T003 Test-first: `parseUtterance(step, transcript, language)` English tables + tests; Spanish unchanged
- [X] T004 English grammars in `frontend/src/config/checkinScripts.ts`; reducer state `language`, grammar and parser by language (`frontend/src/domain/checkin/`) + tests
- [X] T005 `tVoice`/`formatNumber` by language in `frontend/src/config/messages.es.ts`; English voice lines in `messages.en.ts` checked; tests
- [X] T006 `SpeechSynth` language option (local `en*` voices, preferred en-us, en-gb) + tests
- [X] T007 `VoskRecognizer` per-language manifest URL, one model per URL; `VOSK_MANIFEST_URLS` + tests
- [X] T008 Wire: `runCheckin` reads the language at start; composition root passes it to TTS and Vosk; chips stay consistent; tests
- [X] T009 Docs: README (model download, license), decision D56 in `specs/001-chequeo-diario-voz-cuerpo/decisions.md`, `specs/README.md` row 006
- [X] T010 Verify: `npm test`, `npm run lint`, `npm run build` (dist size check)
