import type { CheckinSnapshot } from '../../../application/use-cases/runCheckin';
import { t } from '../../../config/messages.es';

/** Number of questions of the daily check-in: sleep, mood, symptoms. */
export const QUESTION_TOTAL = 3;

interface Question {
  n: number;
  /** Message key of the topic name. */
  topicKey: string;
}

/**
 * Question shown for each step. Only the three questions have a progress; measuring, the verdict
 * and the end show none (the bar is kept, hidden, so the layout does not move).
 */
const QUESTION_BY_STEP: Partial<Record<CheckinSnapshot['step'], Question>> = {
  ask_sleep: { n: 1, topicKey: 'checkin.step.sleep' },
  confirm_sleep: { n: 1, topicKey: 'checkin.step.sleep' },
  ask_mood: { n: 2, topicKey: 'checkin.step.mood' },
  confirm_mood: { n: 2, topicKey: 'checkin.step.mood' },
  ask_symptoms: { n: 3, topicKey: 'checkin.step.symptoms' },
};

export interface CheckinProgressProps {
  step: CheckinSnapshot['step'];
}

/** "Pregunta n de 3 · tema" with a thin bar at the top of the check-in (T080a). */
export function CheckinProgress({ step }: CheckinProgressProps) {
  const question = QUESTION_BY_STEP[step];
  const n = question?.n ?? 0;
  const label = question === undefined ? '' : t('checkin.progress', { n, of: QUESTION_TOTAL, topic: t(question.topicKey) });
  return (
    <div className={`flex flex-col gap-xs ${question === undefined ? 'invisible' : ''}`}>
      <p className="text-small font-semibold text-ink-secondary">{label}</p>
      <div
        role="progressbar"
        aria-label={t('checkin.progressLabel')}
        aria-valuemin={0}
        aria-valuemax={QUESTION_TOTAL}
        aria-valuenow={n}
        aria-valuetext={label}
        className="h-xs overflow-hidden rounded-card bg-track"
      >
        <div
          className="h-full origin-left bg-primary transition-transform motion-reduce:transition-none"
          style={{ transform: `scaleX(${n / QUESTION_TOTAL})` }}
        />
      </div>
    </div>
  );
}
