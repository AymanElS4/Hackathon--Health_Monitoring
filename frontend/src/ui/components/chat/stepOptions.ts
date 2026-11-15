import { MOOD_MAX, MOOD_MIN, SLEEP_HOURS_MAX } from '@base-vital/contracts';
import type { CheckinSnapshot } from '../../../application/use-cases/runCheckin';
import { SLEEP_HOURS_MIN, SLEEP_HOURS_STEP } from '../../../config/constants';
import { formatNumber, t } from '../../../config/messages.es';
import { getLocale } from '../../../config/i18n';

/** Steps that listen for an answer (the same ids the runner can pass to `showButtons`). */
export type AnswerStep = NonNullable<CheckinSnapshot['buttonsFor']>;

export interface StepOption {
  /** Visible word and accessible name (from messages.es.ts). */
  label: string;
  /** Text sent to the check-in, read exactly as a transcript would arrive. */
  value: string;
  /** Large figure above the word (the mood digit). */
  figure?: string;
  /** Emoji before the word, decorative. */
  icon?: string;
}

/** Sleep hours from SLEEP_HOURS_MIN to SLEEP_HOURS_MAX in SLEEP_HOURS_STEP increments. */
function sleepOptions(): StepOption[] {
  const count = Math.round((SLEEP_HOURS_MAX - SLEEP_HOURS_MIN) / SLEEP_HOURS_STEP) + 1;
  return Array.from({ length: count }, (_, index) => {
    const hours = SLEEP_HOURS_MIN + index * SLEEP_HOURS_STEP;
    return {
      label: t('checkin.hoursOption', { h: formatNumber(hours, getLocale()) }),
      value: String(hours),
    };
  });
}

/** Mood 1–5: the word names the mood, the digit is shown above it and is the text the parser reads. */
function moodOptions(): StepOption[] {
  const options: StepOption[] = [];
  for (let mood = MOOD_MIN; mood <= MOOD_MAX; mood += 1) {
    options.push({ label: t(`checkin.moodOption.${mood}`), value: String(mood), figure: String(mood) });
  }
  return options;
}

/** Yes and no, sent as the words the parser reads as confirm and deny. */
function yesNoOptions(): StepOption[] {
  return [
    { label: t('checkin.yes'), value: t('checkin.yes'), icon: t('checkin.yes.icon') },
    { label: t('checkin.no'), value: t('checkin.no'), icon: t('checkin.no.icon') },
  ];
}

/** Only "sí": the next-activity grammar has no "no". */
function yesOnlyOptions(): StepOption[] {
  return [{ label: t('checkin.yes'), value: t('checkin.yes'), icon: t('checkin.yes.icon') }];
}

/** Symptom phrases the parser understands, "Ninguno" first (the order of the chips). */
function symptomOptions(): StepOption[] {
  const keys = [
    'checkin.symptom.none',
    'checkin.symptom.mareo',
    'checkin.symptom.desmayo',
    'checkin.symptom.chestPain',
    'checkin.symptom.breathless',
  ];
  return keys.map((key) => ({ label: t(key), value: t(key) }));
}

/** Options for a step that listens for an answer; other steps have none. */
export function optionsFor(step: AnswerStep): StepOption[] {
  switch (step) {
    case 'ask_sleep':
      return sleepOptions();
    case 'ask_mood':
      return moodOptions();
    case 'confirm_sleep':
    case 'confirm_mood':
      return yesNoOptions();
    case 'next_activity':
      return yesOnlyOptions();
    case 'ask_symptoms':
      return symptomOptions();
    default:
      return [];
  }
}
