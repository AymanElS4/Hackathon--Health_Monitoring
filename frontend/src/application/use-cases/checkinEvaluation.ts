/**
 * Shape of an evaluation as the check-in runner reads it, the team-criterion flag and the action
 * params derived from it, and the next activity (T071, RF9, Principle VIII). `evaluateFromState`
 * results satisfy this shape structurally.
 */
import { SensorKey, type SensorReading, type Verdict } from '@base-vital/contracts';
import type { CheckinOutcome } from '../../domain/checkin/checkinReducer';
import { t } from '../../config/messages.es';
import type { AgendaPort } from '../ports';
import { nextAnnouncement } from './nextAnnouncement';

/** Values for the `{name}` placeholders of an action message, e.g. `{ sensor: 'la presión' }`. */
export type ActionParams = Record<string, string>;

/** Message lookup used for params: `t` for the screen, a language-bound `tVoice` for speech. */
export type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Verdict and action of the check-in. `teamCriterion` sets the team-criterion note and
 * `actionParams` fills the action text (Principle VIII).
 */
export type CheckinSnapshotOutcome = CheckinOutcome & {
  teamCriterion: boolean;
  actionParams: ActionParams;
};

/** Next activity of the day, with its title already translated. */
export interface NextItem {
  title: string;
  time: string;
}

export interface CheckinEvaluation {
  /** Readings snapshot per sensor; stored with the check-in (T093). */
  readings: Record<SensorKey, SensorReading>;
  verdict: Verdict;
  /** Full message key of the one action; `''` when the verdict is `ok`. */
  actionKey: string;
  /** True when the outcomes that set the action are a team criterion. Absent means false. */
  actionTeamCriterion?: boolean;
  /** Sensor with no reading, set when the action is `action.missing_data`. */
  missingSensor?: SensorKey | null;
}

const MISSING_DATA_ACTION = 'action.missing_data';

/** The evaluated reading of each sensor, in `SensorKey` order; a sensor with no reading is left out (T080). */
export function evaluatedReadings(evaluation: Pick<CheckinEvaluation, 'readings'>): SensorReading[] {
  return SensorKey.options.flatMap((sensor) => {
    const reading = evaluation.readings[sensor];
    return reading ? [reading] : [];
  });
}

/**
 * True when the action is a team criterion (RF9, Principle VIII). The rules layer decides which
 * outcome set the action; this only reads that flag.
 */
export function actionIsTeamCriterion(evaluation: Omit<CheckinEvaluation, 'readings'>): boolean {
  return evaluation.actionTeamCriterion === true;
}

/**
 * Placeholder values of the one action: the missing sensor's name for `action.missing_data`,
 * translated with `translate` (the screen `t` by default).
 */
export function actionParams(evaluation: CheckinEvaluation, translate: Translate = t): ActionParams {
  if (evaluation.actionKey !== MISSING_DATA_ACTION || !evaluation.missingSensor) return {};
  return { sensor: translate(`sensor.lower.${evaluation.missingSensor}`) };
}

/** The next activity at `now`, with its title translated; `null` when none is left. */
export function nextItemAt(agenda: AgendaPort, now: Date, translate: Translate = t): NextItem | null {
  const item = nextAnnouncement(agenda, now);
  return item === null ? null : { title: translate(item.titleKey), time: item.time };
}

/** What the runner keeps from an evaluation: the snapshot outcome fields and the next activity. */
export interface EvaluationFacts {
  outcome: Pick<CheckinSnapshotOutcome, 'teamCriterion' | 'actionParams'>;
  nextItem: NextItem | null;
}

/** Facts of an evaluation, read when the verdict is known. */
export function evaluationFacts(
  evaluation: CheckinEvaluation,
  agenda: AgendaPort,
  now: Date,
): EvaluationFacts {
  return {
    outcome: { teamCriterion: actionIsTeamCriterion(evaluation), actionParams: actionParams(evaluation) },
    nextItem: nextItemAt(agenda, now),
  };
}

/** What a check-in line needs from the run: the verdict (`null` before it), the agenda and the clock. */
export interface LineContext {
  verdict: CheckinEvaluation | null;
  agenda: AgendaPort;
  now: Date;
}

/**
 * Text of a check-in line key through `translate`: `t` for the caption, a language-bound `tVoice`
 * for the spoken line (006). Action and next-activity params are translated the same way.
 */
export function lineText(
  translate: Translate,
  key: string,
  params: Record<string, string | number> | undefined,
  context: LineContext,
): string {
  if (key === 'confirm.sleep' && params?.hours === 1) return translate('confirm.sleep.one');
  // Action keys take their params from the verdict (e.g. the missing sensor's name).
  if (key.startsWith('action.')) {
    return translate(key, context.verdict === null ? {} : actionParams(context.verdict, translate));
  }
  if (key !== 'next') return translate(key, params);
  const item = nextItemAt(context.agenda, context.now, translate);
  if (item === null) return translate('next.none');
  return translate('next', { title: item.title, time: item.time });
}
