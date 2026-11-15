/**
 * Dev-only timing of the check-in (T095): the recorder that the runner and the adapters feed, and the
 * comparison of the last run with the plan.md targets.
 */
import { describe, it, expect, vi } from 'vitest';
import {
  checkTargets,
  createDevMetricsRecorder,
  markCheckinEvent,
  type DevMetricsSnapshot,
} from '../../src/application/devMetrics';
import { DEV_TARGETS } from '../../src/config/constants';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { checkinScripts } from '../../src/config/checkinScripts';

/** A run whose every metric is inside its target. */
const WITHIN: DevMetricsSnapshot = {
  checkinMs: 41_000,
  voiceStart: { worst: 120, count: 3 },
  finalTranscript: { worst: 500, count: 3 },
  fps: 58,
};

/** Result of one metric in the checks. */
function resultOf(snapshot: DevMetricsSnapshot, metric: string) {
  const result = checkTargets(snapshot).find((item) => item.metric === metric);
  if (result === undefined) throw new Error(`no result for ${metric}`);
  return result;
}

describe('createDevMetricsRecorder', () => {
  it('times the check-in from the start tap to saved', () => {
    const recorder = createDevMetricsRecorder();
    expect(recorder.getSnapshot().checkinMs).toBeNull();

    recorder.markStart(1_000);
    recorder.markSaved(43_500);

    expect(recorder.getSnapshot().checkinMs).toBe(42_500);
  });

  it('pairs each listen with the prompt before it, and ignores a listen with no prompt', () => {
    const recorder = createDevMetricsRecorder();
    recorder.markStart(0);
    recorder.markListening(50); // no prompt pending: not a sample
    recorder.markPromptEnd(1_000);
    recorder.markListening(1_120);
    recorder.markPromptEnd(5_000);
    recorder.markListening(5_250);

    expect(recorder.getSnapshot().voiceStart).toEqual({ worst: 250, count: 2 });
  });

  it('times the final transcript from the last partial result', () => {
    const recorder = createDevMetricsRecorder();
    recorder.markStart(0);
    recorder.markFinal(2_600, 2_000);

    expect(recorder.getSnapshot().finalTranscript).toEqual({ worst: 600, count: 1 });
  });

  it('starts a new run on start: the previous marks are cleared, the last frame rate is kept', () => {
    const recorder = createDevMetricsRecorder();
    recorder.markStart(0);
    recorder.markPromptEnd(100);
    recorder.markListening(200);
    recorder.markFinal(900, 700);
    recorder.markSaved(10_000);
    recorder.markFps(57);

    recorder.markStart(20_000);

    expect(recorder.getSnapshot()).toEqual({
      checkinMs: null,
      voiceStart: null,
      finalTranscript: null,
      fps: 57,
    });
  });

  it('notifies subscribers on every change and stops after unsubscribe', () => {
    const recorder = createDevMetricsRecorder();
    const listener = vi.fn();
    const unsubscribe = recorder.subscribe(listener);

    recorder.markStart(0);
    recorder.markFps(60);
    expect(listener).toHaveBeenCalledTimes(2);
    expect(recorder.getSnapshot().fps).toBe(60);

    unsubscribe();
    recorder.markFps(30);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});

describe('markCheckinEvent', () => {
  it('maps the start tap, the end of a prompt and saved to the clock of the tap', () => {
    const recorder = createDevMetricsRecorder();
    let now = 0;
    const tap = { recorder, now: () => now };

    now = 100;
    markCheckinEvent(tap, { type: 'start' });
    now = 900;
    markCheckinEvent(tap, { type: 'spoken' });
    now = 1_000;
    markCheckinEvent(tap, { type: 'transcript', text: 'siete' });
    now = 30_100;
    markCheckinEvent(tap, { type: 'saved' });

    expect(recorder.getSnapshot().checkinMs).toBe(30_000);
  });

  it('does nothing without a tap', () => {
    expect(() => markCheckinEvent(undefined, { type: 'start' })).not.toThrow();
  });
});

describe('checkTargets', () => {
  it('meets every target when the run is inside them', () => {
    const results = checkTargets(WITHIN);

    expect(results.map((result) => [result.metric, result.met])).toEqual([
      ['checkin', true],
      ['voiceStart', true],
      ['finalTranscript', true],
      ['fps', true],
    ]);
    expect(resultOf(WITHIN, 'checkin').target).toBe(DEV_TARGETS.checkinMs);
  });

  it('counts a value exactly at a latency bound, and a frame rate exactly at 30, as met', () => {
    const atBound: DevMetricsSnapshot = {
      checkinMs: DEV_TARGETS.checkinMs,
      voiceStart: { worst: DEV_TARGETS.voiceStartMs, count: 1 },
      finalTranscript: { worst: DEV_TARGETS.finalTranscriptMs, count: 1 },
      fps: DEV_TARGETS.fps,
    };

    expect(checkTargets(atBound).every((result) => result.met === true)).toBe(true);
  });

  it('exceeds the targets when the check-in is slower, the voice or transcript slower, or fps lower', () => {
    const over: DevMetricsSnapshot = {
      checkinMs: 75_000,
      voiceStart: { worst: 350, count: 2 },
      finalTranscript: { worst: 900, count: 2 },
      fps: 24,
    };

    expect(checkTargets(over).map((result) => result.met)).toEqual([false, false, false, false]);
  });

  it('checks latency on the slowest sample of the run, not the last one', () => {
    const slowEarlier: DevMetricsSnapshot = {
      ...WITHIN,
      voiceStart: { worst: 400, count: 4 },
    };

    expect(resultOf(slowEarlier, 'voiceStart')).toMatchObject({ value: 400, met: false });
  });

  it('reports a metric that was not measured as null, never as met', () => {
    const empty: DevMetricsSnapshot = { checkinMs: null, voiceStart: null, finalTranscript: null, fps: null };

    expect(checkTargets(empty).map((result) => result.met)).toEqual([null, null, null, null]);
  });
});

describe('the check-in runner feeds the recorder', () => {
  it('times a full daily check-in from start to saved, and a prompt to the next listen', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const recorder = createDevMetricsRecorder();
    let now = 0;
    const runner = createCheckinRunner({
      recognizer: voice,
      synthesizer: voice,
      devices: new FakeDevices({
        resting_heart_rate: 70,
        blood_pressure: { systolic: 118, diastolic: 76 },
        body_temperature: 36.6,
        oxygen_saturation: 98,
      }),
      agenda: new StaticAgenda(DEMO_AGENDA),
      clock: new FixedClock(new Date(2026, 0, 1, 9, 0)),
      repository: new MemoryCheckRepository(),
      evaluate: (state) => ({
        verdict: 'ok',
        actionKey: '',
        readings: evaluateFromState(state, { at: new Date(2026, 0, 1, 9, 0).toISOString() }).readings,
      }),
      script: checkinScripts.daily,
      metrics: { recorder, now: () => now },
    });

    now = 1_000;
    const done = runner.start();
    for (const answer of ['siete', 'sí', 'cuatro', 'sí', 'no', 'sí']) {
      await vi.waitFor(() => expect(voice.isListening()).toBe(true));
      now += 500;
      voice.answer(answer);
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    await done;

    const snapshot = recorder.getSnapshot();
    expect(runner.getSnapshot().step).toBe('saved');
    expect(snapshot.checkinMs).not.toBeNull();
    expect(snapshot.checkinMs).toBeGreaterThan(0);
    // The fake voice does not report microphone timing, so the voice metrics stay unmeasured.
    expect(snapshot.voiceStart).toBeNull();
    expect(snapshot.finalTranscript).toBeNull();
  });
});
