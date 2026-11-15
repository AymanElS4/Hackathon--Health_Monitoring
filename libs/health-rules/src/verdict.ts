import type { Indicator, Level, Symptom, Verdict } from '@base-vital/contracts';

/**
 * One indicator after its level is known. `level` is `unknown` when the indicator has no
 * observation (CL2), so a missing value never reads as ok.
 */
export interface IndicatorOutcome {
  indicator: Indicator;
  level: Level;
  /** Body temperature at or above the fever bound (CDC). Always false for other indicators. */
  fever: boolean;
  /** True when the band that set `level` is a team criterion (Principle VIII). */
  teamCriterion: boolean;
}

export interface VerdictInput {
  outcomes: readonly IndicatorOutcome[];
  symptoms: readonly Symptom[];
  /**
   * Some sensor is outside its personal normal ("fuera de tu normal", RN3). A team criterion:
   * it sets the action with `actionTeamCriterion` true.
   */
  outsideNormal: boolean;
}

export interface VerdictResult {
  verdict: Verdict;
  /** Full message key; `''` when the verdict is `ok` (messages.es.ts has no `action.ok`). */
  actionKey: string;
  /** True when an outcome that set the action is a team criterion (Principle VIII). */
  actionTeamCriterion: boolean;
}

const SLEEP_INDICATOR: Indicator = 'sleep_hours';
const TEMPERATURE_INDICATOR: Indicator = 'body_temperature';
/** Two amber values (not sensors) raise the verdict to alert (RN5). */
const AMBER_VALUES_FOR_ALERT = 2;

/**
 * Overall verdict (RN5) and the single action (RF9, CL2).
 *
 * - alert: any red value, or two or more amber values.
 * - attention: one amber value, any in_doubt or unknown value, or any symptom other than `none`.
 * - ok: none of the above.
 *
 * Action priority, first match wins: a red not caused by temperature > fever (temperature at or
 * above 38.0 °C) > any other red (hypothermia) > two amber > single amber (`action.slept_little`
 * for sleep, otherwise `action.single_amber`) > symptom > outside normal > in doubt > missing
 * data > ok (`''`).
 */
export function decideVerdict(input: VerdictInput): VerdictResult {
  const { outcomes, outsideNormal } = input;
  const symptomReported = input.symptoms.some((symptom) => symptom !== 'none');
  const reds = outcomes.filter((outcome) => outcome.level === 'red');
  const ambers = outcomes.filter((outcome) => outcome.level === 'amber');
  const inDoubt = outcomes.some((outcome) => outcome.level === 'in_doubt');
  const missing = outcomes.some((outcome) => outcome.level === 'unknown');
  const fever = outcomes.some((outcome) => outcome.fever);

  const alert = reds.length > 0 || ambers.length >= AMBER_VALUES_FOR_ALERT;
  const attention =
    ambers.length === 1 || inDoubt || missing || symptomReported || outsideNormal;
  const verdict: Verdict = alert ? 'alert' : attention ? 'attention' : 'ok';

  const action = actionOf({
    reds,
    ambers,
    fever,
    symptomReported,
    outsideNormal,
    inDoubt,
    missing,
  });
  return { verdict, actionKey: action.actionKey, actionTeamCriterion: action.teamCriterion };
}

type ActionFacts = {
  reds: readonly IndicatorOutcome[];
  ambers: readonly IndicatorOutcome[];
  fever: boolean;
  symptomReported: boolean;
  outsideNormal: boolean;
  inDoubt: boolean;
  missing: boolean;
};

/** The chosen action and whether the outcomes that set it are a team criterion. */
type ActionChoice = { actionKey: string; teamCriterion: boolean };

function choice(actionKey: string, teamCriterion = false): ActionChoice {
  return { actionKey, teamCriterion };
}

function actionOf(facts: ActionFacts): ActionChoice {
  const { reds, ambers } = facts;
  // A red caused by something other than temperature outranks the fever action.
  const valueReds = reds.filter((outcome) => outcome.indicator !== TEMPERATURE_INDICATOR);
  if (valueReds.length > 0) {
    return choice('action.red', valueReds.some((outcome) => outcome.teamCriterion));
  }
  if (facts.fever) return choice('action.fever');
  // What is left in red is hypothermia (temperature below 35.0 °C).
  if (reds.length > 0) return choice('action.red');
  if (ambers.length >= AMBER_VALUES_FOR_ALERT) {
    return choice('action.two_amber', ambers.some((outcome) => outcome.teamCriterion));
  }
  if (ambers.length === 1) {
    const key = ambers[0].indicator === SLEEP_INDICATOR ? 'action.slept_little' : 'action.single_amber';
    return choice(key, ambers[0].teamCriterion);
  }
  if (facts.symptomReported) return choice('action.symptom');
  if (facts.outsideNormal) return choice('action.outside_normal', true);
  if (facts.inDoubt) return choice('action.in_doubt');
  if (facts.missing) return choice('action.missing_data');
  return choice('');
}
