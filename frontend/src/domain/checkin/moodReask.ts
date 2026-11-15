/**
 * CL4 mood re-ask rules (T086, decision D33). Pure helpers used by the check-in reducer: when the
 * mood is asked once more, and how the re-asked answer settles the mood. They return values only;
 * the reducer builds the effects.
 */
import type { VoiceValue } from './checkinReducer';

/** CL4: a confirmed mood at or above this, with the pulse outside "tu normal", is asked once more. */
export const MOOD_REASK_MIN = 4;

/** The mood confirmed so far (the first answer), or `undefined` when none is confirmed. */
export function confirmedMood(confirmedVoice: readonly VoiceValue[]): number | undefined {
  return confirmedVoice.find((value) => value.indicator === 'mood')?.value;
}

/** CL4: the mood is asked once more when the pulse is outside normal, the mood is ≥ 4, and it was not asked before. */
export function needsMoodReask(input: {
  pulseOutsideNormal: boolean;
  moodReasked: boolean;
  confirmedVoice: readonly VoiceValue[];
}): boolean {
  const mood = confirmedMood(input.confirmedVoice);
  return (
    input.pulseOutsideNormal &&
    !input.moodReasked &&
    mood !== undefined &&
    mood >= MOOD_REASK_MIN
  );
}

/**
 * The re-asked mood, once confirmed with "sí". It replaces the mood in `confirmedVoice` (the first
 * answer is dropped). The same value as the first confirmed mood puts the mood in doubt (`inDoubt`).
 */
export function settleMoodReask(
  confirmedVoice: readonly VoiceValue[],
  heard: VoiceValue,
): { confirmedVoice: VoiceValue[]; inDoubt: boolean } {
  const same = confirmedMood(confirmedVoice) === heard.value;
  return {
    confirmedVoice: confirmedVoice.map((value) => (value.indicator === 'mood' ? heard : value)),
    inDoubt: same,
  };
}
