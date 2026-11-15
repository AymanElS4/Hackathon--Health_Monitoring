import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { SensorKey, SensorReading } from '@base-vital/contracts';
import type { CheckinSnapshot } from '../application/use-cases/runCheckin';
import { useAppServices } from './AppServices';

/** Structural view of the fake voice (feature-detected; ui never imports adapters). */
interface AnswerableVoice {
  answer(text: string): void;
  isListening(): boolean;
  onListen(cb: (listening: boolean) => void): () => void;
}

function isAnswerable(value: unknown): value is AnswerableVoice {
  const voice = value as Partial<AnswerableVoice> | null;
  return (
    typeof voice?.answer === 'function' &&
    typeof voice.isListening === 'function' &&
    typeof voice.onListen === 'function'
  );
}

/** What the body needs from the check-in (T080): readings after evaluation, the focus and the measuring flag. */
export interface CheckinBodyView {
  readings: SensorReading[];
  /** Sensor being discussed (halo): sleep while asking about sleep and mood, the device while measuring. */
  focus: SensorKey | null;
  /** True while the focused device is being measured (spinner). */
  measuring: boolean;
  /** True once the verdict exists. Before it, the dots are plain identity dots (no levels). */
  evaluated: boolean;
}

export interface UseCheckin {
  snapshot: CheckinSnapshot;
  bodyView: CheckinBodyView;
  start: () => void;
  pause: () => void;
  resume: () => void;
  repeat: () => void;
  /** Answers the step the big buttons show (`snapshot.buttonsFor`) with the parser text. */
  answerButton: (text: string) => void;
  /** Present only when the voice is the fake. */
  answer?: (text: string) => void;
  /** Present only when the voice is the fake: true while it waits for an answer. */
  fakeListening?: boolean;
}

export function useCheckin(): UseCheckin {
  const services = useAppServices();
  const runner = useMemo(() => services.createCheckinRunner(), [services]);
  const snapshot = useSyncExternalStore(runner.subscribe, runner.getSnapshot);
  const fake = isAnswerable(services.recognizer) ? services.recognizer : null;
  const [fakeListening, setFakeListening] = useState(fake?.isListening() ?? false);

  useEffect(() => (fake ? fake.onListen(setFakeListening) : undefined), [fake]);
  // Leaving the screen stops listening and speech. The mounted flag is read in a microtask so
  // that React StrictMode's simulated unmount and remount (development only, same commit) does
  // not dispose the runner before the screen starts it.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      queueMicrotask(() => {
        if (!mounted.current) runner.dispose();
      });
    };
  }, [runner]);

  const run = (type: 'start' | 'pause' | 'resume' | 'repeat') => () => {
    void runner.dispatch({ type });
  };

  const bodyView: CheckinBodyView = {
    readings: snapshot.readings,
    focus: snapshot.focus,
    measuring: snapshot.step === 'measuring' && snapshot.focus !== null,
    evaluated: snapshot.outcome !== null,
  };

  return {
    snapshot,
    bodyView,
    start: () => void runner.start(),
    pause: run('pause'),
    resume: run('resume'),
    repeat: run('repeat'),
    answerButton: (text: string) => {
      void runner.dispatch({ type: 'buttonAnswer', text });
    },
    ...(fake ? { answer: (text: string) => fake.answer(text), fakeListening } : {}),
  };
}
