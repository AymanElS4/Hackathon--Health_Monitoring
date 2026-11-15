import { MOOD_MAX, MOOD_MIN, SLEEP_HOURS_MAX } from '@base-vital/contracts';
import type { CheckinSnapshot } from '../../application/use-cases/runCheckin';
import { SLEEP_HOURS_MIN, SLEEP_HOURS_STEP } from '../../config/constants';
import { formatNumber, t } from '../../config/messages.es';
import { Button } from './Button';

/** Steps that listen for an answer (the same ids the runner can pass to `showButtons`). */
type StepId = NonNullable<CheckinSnapshot['buttonsFor']>;

export interface BigButtonsProps {
  step: StepId;
  /** Receives the text the parser reads, exactly as a transcript would arrive. */
  onAnswer: (text: string) => void;
}

interface Option {
  label: string;
  value: string;
}

const GRID = 'grid grid-cols-3 gap-sm';

/** Sleep hours from SLEEP_HOURS_MIN to SLEEP_HOURS_MAX in SLEEP_HOURS_STEP increments. */
function sleepOptions(): Option[] {
  const count = Math.round((SLEEP_HOURS_MAX - SLEEP_HOURS_MIN) / SLEEP_HOURS_STEP) + 1;
  return Array.from({ length: count }, (_, index) => {
    const hours = SLEEP_HOURS_MIN + index * SLEEP_HOURS_STEP;
    return {
      label: t('checkin.hoursOption', { h: formatNumber(hours) }),
      value: String(hours),
    };
  });
}

/** Mood 1–5: the label names the mood, the value is the digit the parser reads. */
function moodOptions(): Option[] {
  const options: Option[] = [];
  for (let mood = MOOD_MIN; mood <= MOOD_MAX; mood += 1) {
    options.push({ label: t(`checkin.moodOption.${mood}`), value: String(mood) });
  }
  return options;
}

/** Yes and no, sent as the words the parser reads as confirm and deny. */
function yesNoOptions(): Option[] {
  const options = [t('checkin.yes'), t('checkin.no')];
  return options.map((text) => ({ label: text, value: text }));
}

/** Only "sí": the next-activity grammar has no "no". */
function yesOnlyOptions(): Option[] {
  return [{ label: t('checkin.yes'), value: t('checkin.yes') }];
}

/** Symptom phrases the parser understands; "ninguno" means no symptom. */
function symptomOptions(): Option[] {
  const keys = [
    'checkin.symptom.mareo',
    'checkin.symptom.desmayo',
    'checkin.symptom.chestPain',
    'checkin.symptom.breathless',
    'checkin.symptom.none',
  ];
  return keys.map((key) => ({ label: t(key), value: t(key) }));
}

/** Options for a step that listens for an answer; other steps have none. */
function optionsFor(step: StepId): Option[] {
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

/** Big touch buttons that answer a step in place of the voice (CL1, RF12). */
export function BigButtons({ step, onAnswer }: BigButtonsProps) {
  const options = optionsFor(step);
  if (options.length === 0) return null;
  return (
    <div className={GRID}>
      {options.map((option) => (
        <Button key={option.value} onClick={() => onAnswer(option.value)}>
          {option.label}
        </Button>
      ))}
    </div>
  );
}
