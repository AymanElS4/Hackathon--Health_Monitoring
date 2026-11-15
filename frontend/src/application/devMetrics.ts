/**
 * Dev-only timing of the check-in (T095, plan.md "Performance Goals"). Pure: it reads no clock and
 * touches no DOM. Callers pass timestamps in milliseconds on one monotonic base (the composition
 * root uses `performance.now()`). Only the last run is kept, in memory; nothing is persisted.
 */
import type { CheckinEvent } from '../domain/checkin/types';
import { DEV_TARGETS } from '../config/constants';

/** Samples of one latency metric in the last run. */
export interface LatencySummary {
  /** Slowest sample of the run, ms. The target is checked against this one. */
  worst: number;
  count: number;
}

export interface DevMetricsSnapshot {
  /** Start tap to `saved`, ms; `null` until the run is saved. */
  checkinMs: number | null;
  /** Prompt end to microphone open, ms; `null` when no listen followed a prompt. */
  voiceStart: LatencySummary | null;
  /** End of speech (last partial) to the final transcript, ms; `null` when no transcript was timed. */
  finalTranscript: LatencySummary | null;
  /** Frame rate of the 3D canvas over the last window; `null` until the first window. */
  fps: number | null;
}

export interface DevMetricsRecorder {
  /** Starts a new run: clears the marks of the previous one. */
  markStart(at: number): void;
  /** The prompt was spoken: the next listen start is measured from here. */
  markPromptEnd(at: number): void;
  /** The microphone opened. Pairs with the last prompt end, if none is pending it is ignored. */
  markListening(at: number): void;
  /** The final transcript arrived, `lastPartialAt` ms after the last partial result. */
  markFinal(finalAt: number, lastPartialAt: number): void;
  markSaved(at: number): void;
  /** Average frame rate of the last window of the 3D render loop. */
  markFps(fps: number): void;
  getSnapshot(): DevMetricsSnapshot;
  subscribe(callback: () => void): () => void;
}

/** The runner's view of the recorder: the recorder and the clock its marks are read from. */
export interface DevMetricsTap {
  recorder: DevMetricsRecorder;
  now: () => number;
}

interface RunMarks {
  startAt: number | null;
  savedAt: number | null;
  promptEndAt: number | null;
  voiceStarts: readonly number[];
  finals: readonly number[];
}

function emptyRun(): RunMarks {
  return { startAt: null, savedAt: null, promptEndAt: null, voiceStarts: [], finals: [] };
}

function summaryOf(samples: readonly number[]): LatencySummary | null {
  if (samples.length === 0) return null;
  return { worst: Math.max(...samples), count: samples.length };
}

function snapshotOf(run: RunMarks, fps: number | null): DevMetricsSnapshot {
  const checkinMs = run.startAt !== null && run.savedAt !== null ? run.savedAt - run.startAt : null;
  return {
    checkinMs,
    voiceStart: summaryOf(run.voiceStarts),
    finalTranscript: summaryOf(run.finals),
    fps,
  };
}

export function createDevMetricsRecorder(): DevMetricsRecorder {
  let run = emptyRun();
  let fps: number | null = null;
  let snapshot = snapshotOf(run, fps);
  const subscribers = new Set<() => void>();

  function publish(): void {
    snapshot = snapshotOf(run, fps);
    for (const callback of [...subscribers]) callback();
  }

  // Methods use closures, not `this`: the recorder is passed around as plain functions.
  return {
    markStart(at) {
      run = { ...emptyRun(), startAt: at };
      publish();
    },
    markPromptEnd(at) {
      run = { ...run, promptEndAt: at };
      publish();
    },
    markListening(at) {
      const promptEnd = run.promptEndAt;
      if (promptEnd === null) return;
      run = { ...run, promptEndAt: null, voiceStarts: [...run.voiceStarts, at - promptEnd] };
      publish();
    },
    markFinal(finalAt, lastPartialAt) {
      run = { ...run, finals: [...run.finals, finalAt - lastPartialAt] };
      publish();
    },
    markSaved(at) {
      run = { ...run, savedAt: at };
      publish();
    },
    markFps(value) {
      fps = value;
      publish();
    },
    getSnapshot: () => snapshot,
    subscribe(callback) {
      subscribers.add(callback);
      return () => {
        subscribers.delete(callback);
      };
    },
  };
}

/**
 * Feeds the recorder from the check-in events that stand for the start tap, the end of a prompt and
 * the end of the check-in (`saved`, which comes after the save attempt). A missing tap does nothing.
 */
export function markCheckinEvent(tap: DevMetricsTap | undefined, event: CheckinEvent): void {
  if (tap === undefined) return;
  switch (event.type) {
    case 'start':
      return tap.recorder.markStart(tap.now());
    case 'spoken':
      return tap.recorder.markPromptEnd(tap.now());
    case 'saved':
      return tap.recorder.markSaved(tap.now());
    default:
      return;
  }
}

export type DevMetricKey = 'checkin' | 'voiceStart' | 'finalTranscript' | 'fps';

export interface TargetResult {
  metric: DevMetricKey;
  /** The value checked against the target; `null` when not measured. */
  value: number | null;
  target: number;
  /** `null` when not measured. */
  met: boolean | null;
}

/**
 * The last run against the targets. Latencies are met at or below the target, checked on the
 * slowest sample. The frame rate is met at or above the target, checked on the last window.
 */
export function checkTargets(snapshot: DevMetricsSnapshot): TargetResult[] {
  const latency = (metric: DevMetricKey, value: number | null, target: number): TargetResult => ({
    metric,
    value,
    target,
    met: value === null ? null : value <= target,
  });
  return [
    latency('checkin', snapshot.checkinMs, DEV_TARGETS.checkinMs),
    latency('voiceStart', snapshot.voiceStart?.worst ?? null, DEV_TARGETS.voiceStartMs),
    latency('finalTranscript', snapshot.finalTranscript?.worst ?? null, DEV_TARGETS.finalTranscriptMs),
    {
      metric: 'fps',
      value: snapshot.fps,
      target: DEV_TARGETS.fps,
      met: snapshot.fps === null ? null : snapshot.fps >= DEV_TARGETS.fps,
    },
  ];
}
