# Plan — 006 English voice check-in

Constitution 1.4.0, Principle II (voice follows the selected language). Frontend only.

- **Language type**: `VoiceLanguage = 'es' | 'en'` in `domain/parsing/` (domain must not import config);
  `Locale` in `config/i18n.ts` has the same values.
- **Domain**: `parseUtterance(step, transcript, language = 'es')` with a per-language word table;
  `englishNumbers.ts` beside `spanishNumbers.ts`. `CheckinState` gets `language`; the reducer passes it.
- **Config**: `checkinScripts.ts` gets English grammars; each listening step's `grammar` becomes
  `{ es, en }` and the reducer indexes it with `state.language`. `messages.es.ts`: `tVoice(key, params, language)`; `formatNumber` per language.
- **Adapters**: `SpeechSynth({ language: () => VoiceLanguage })` picks a voice per language at speak
  time (cached per language). `VoskRecognizer({ language: () => VoiceLanguage })` resolves `VOSK_MANIFEST_URLS[language]` and keeps one
  model per URL. Adapters declare their own `VoiceLanguage` type (they may not import domain).
- **Application**: `runCheckin` reads the language once at start (dep `language: () => VoiceLanguage`),
  stores it in the state, and passes it to `tVoice`. The composition root keeps a holder that the
  adapters read; it follows the screen locale on Home (so the right model is preloaded) and is fixed
  while a check-in runs.
- **Model**: `public/models/vosk/en/` (parts + manifest, split with `scripts/split-model.ts`). README:
  download/split steps and license line.
