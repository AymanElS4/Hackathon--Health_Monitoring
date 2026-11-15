/**
 * Chat transcript of the check-in (T080a). Pure: `advanceConversation(state, snapshot)` folds one
 * runner snapshot into the list of messages. Applied to every snapshot in order, it appends each
 * message once: Vita's lines, Ana's heard and confirmed answers, Ana's "No", her symptoms and the
 * verdict as the last message. The runner is not changed; it only exposes its history.
 */
import type { Verdict } from '@base-vital/contracts';
import type { CheckinSnapshot, NextItem, CheckinSnapshotOutcome } from '../application/use-cases/runCheckin';
import { t } from '../config/messages.es';

/** A voice value as the runner reports it (`pending`, `confirmedVoice`). */
type VoiceValue = NonNullable<CheckinSnapshot['pending']>;

/** Vita's lines of these steps are part of the verdict message, not separate bubbles. */
const VERDICT_STEPS: ReadonlySet<CheckinSnapshot['step']> = new Set(['summary', 'next_activity']);

/**
 * Symptom enum value → label of its chip (Ana's bubble). The labels are the chip labels, so the
 * bubble reads like the chip Ana tapped.
 */
const SYMPTOM_KEYS: Record<string, string> = {
  dizziness: 'checkin.symptom.mareo',
  fainting: 'checkin.symptom.desmayo',
  chest_pain: 'checkin.symptom.chestPain',
  shortness_of_breath: 'checkin.symptom.breathless',
  none: 'checkin.symptom.none',
};

export type ChatMessage =
  | { kind: 'vita'; id: string; text: string }
  /** Ana's answer. `live` while the value waits for its confirmation (dashed bubble). */
  | { kind: 'ana'; id: string; text: string; live: boolean }
  | {
      kind: 'verdict';
      id: string;
      verdict: Verdict;
      actionKey: string;
      actionParams: CheckinSnapshotOutcome['actionParams'];
      next: NextItem | null;
    };

export interface ConversationState {
  messages: readonly ChatMessage[];
  /** Number of snapshot `spoken` lines already read. */
  seenLines: number;
  /** Number of confirmed voice values already read. */
  seenConfirmed: number;
  seenSymptoms: boolean;
  verdictShown: boolean;
  savedShown: boolean;
  /** Whether the last snapshot read had a value waiting for its confirmation. */
  pendingSeen: boolean;
  /** Id of the live Ana bubble waiting for its confirmation, `null` when none. */
  liveId: string | null;
  /** Counter used to build unique message ids. */
  serial: number;
}

export function createConversationState(): ConversationState {
  return {
    messages: [],
    seenLines: 0,
    seenConfirmed: 0,
    seenSymptoms: false,
    verdictShown: false,
    savedShown: false,
    pendingSeen: false,
    liveId: null,
    serial: 0,
  };
}

/** Text of a voice value as Ana's bubble shows it: "5 horas", "1 hora", "4 de 5". */
export function voiceText(value: VoiceValue): string {
  if (value.indicator === 'mood') return t('answer.mood', { mood: value.value });
  return value.value === 1 ? t('answer.sleep.one') : t('answer.sleep', { hours: value.value });
}

/** Folds one snapshot into the transcript. Idempotent for a snapshot already read. */
export function advanceConversation(state: ConversationState, snap: CheckinSnapshot): ConversationState {
  let messages: ChatMessage[] = [...state.messages];
  let serial = state.serial;
  let liveId = state.liveId;
  const nextId = (prefix: string): string => {
    serial += 1;
    return `${prefix}-${serial}`;
  };
  const replaceLive = (patch: Partial<Extract<ChatMessage, { kind: 'ana' }>>) => {
    const id = liveId;
    messages = messages.map((message) =>
      message.id === id && message.kind === 'ana' ? { ...message, ...patch } : message,
    );
  };
  const newConfirmed = snap.confirmedVoice.slice(state.seenConfirmed);

  // 1. A value heard and waiting for its confirmation: the dashed bubble, refreshed when it changes.
  if (snap.pending !== null && liveId === null) {
    liveId = nextId('heard');
    messages.push({ kind: 'ana', id: liveId, text: voiceText(snap.pending), live: true });
  } else if (snap.pending !== null) {
    replaceLive({ text: voiceText(snap.pending) });
  }

  // 2. Values confirmed with "sí": the live bubble turns solid (or a solid one is added), then Ana's "Sí".
  for (const value of newConfirmed) {
    const text = voiceText(value);
    if (liveId !== null) {
      replaceLive({ text, live: false });
      liveId = null;
    } else {
      messages.push({ kind: 'ana', id: nextId('answer'), text, live: false });
    }
    messages.push({ kind: 'ana', id: nextId('yes'), text: t('checkin.yes'), live: false });
  }

  // 3. "no": a value was waiting, and it went away with no new confirmation. Its bubble is replaced by "No".
  if (state.pendingSeen && snap.pending === null && newConfirmed.length === 0) {
    const id = liveId;
    messages = messages.filter((message) => message.id !== id);
    liveId = null;
    messages.push({ kind: 'ana', id: nextId('answer'), text: t('checkin.no'), live: false });
  }

  // 4. Symptoms answered: Ana's bubble lists them.
  if (!state.seenSymptoms && snap.symptoms.length > 0) {
    const text = snap.symptoms.map((symptom) => t(SYMPTOM_KEYS[symptom] ?? symptom)).join(', ');
    messages.push({ kind: 'ana', id: nextId('symptoms'), text, live: false });
  }

  // 5. Vita's new lines, in order. Verdict-step lines are shown inside the verdict message.
  for (const line of snap.spoken.slice(state.seenLines)) {
    if (VERDICT_STEPS.has(line.step)) continue;
    messages.push({ kind: 'vita', id: `line-${line.id}`, text: line.text });
  }

  // 6. The verdict, once known: Vita's last message.
  if (!state.verdictShown && snap.outcome !== null) {
    messages.push({
      kind: 'verdict',
      id: 'verdict',
      verdict: snap.outcome.verdict,
      actionKey: snap.outcome.actionKey,
      actionParams: snap.outcome.actionParams,
      next: snap.nextItem,
    });
  }

  // 7. The check is saved: Ana's "sí" to the next activity, after the verdict.
  const savedShown = state.savedShown || snap.step === 'saved';
  if (!state.savedShown && snap.step === 'saved') {
    messages.push({ kind: 'ana', id: nextId('yes'), text: t('checkin.yes'), live: false });
  }

  return {
    messages,
    seenLines: snap.spoken.length,
    seenConfirmed: snap.confirmedVoice.length,
    seenSymptoms: state.seenSymptoms || snap.symptoms.length > 0,
    verdictShown: state.verdictShown || snap.outcome !== null,
    savedShown,
    pendingSeen: snap.pending !== null,
    liveId,
    serial,
  };
}
