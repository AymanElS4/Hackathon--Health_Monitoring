/**
 * Tests for the check-in screen (T056). The container is built by hand from fakes and the
 * real runner (T052) with the daily script; the screen only sees it through AppServicesProvider.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { StrictMode } from 'react';
import type { SensorKey, SensorReading } from '@base-vital/contracts';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Switch, useLocation } from 'react-router-dom';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { CheckIn } from '../../src/ui/screens/CheckIn';
import { Home } from '../../src/ui/screens/Home';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { SimulatedDevices } from '../../src/adapters/simulated-devices/SimulatedDevices';
import { createCheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { checkinScripts } from '../../src/config/checkinScripts';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { LISTEN_TIMEOUT_MS } from '../../src/config/constants';
import { messages, t } from '../../src/config/messages.es';

/** Local 09:20 on the demo day: the agenda's next item is "Chequeo diario" at 09:30. */
const DEMO_NOW = new Date(2026, 10, 15, 9, 20);

function memoryStorage() {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

// jsdom has no WebGL: the body shows its fallback image and dots (CL5).
beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** The sleep dot as an altered team-criterion reading ("Sueño · atención*"), for the note tests. */
function markSleepDot(readings: Record<SensorKey, SensorReading>): Record<SensorKey, SensorReading> {
  return {
    ...readings,
    sleep: {
      sensor: 'sleep',
      value: '5 h',
      level: 'amber',
      phase: 'confirmed',
      outsideNormal: false,
      reason: 'mood',
      teamCriterion: true,
    },
  };
}

/**
 * `missingSensor`: scenario missing_sensor (blood pressure sends nothing) with the real verdict
 * rules; otherwise a fixed "slept little" evaluation on fake devices. `markedSleep`: the sleep dot
 * carries the team-criterion mark.
 */
function buildContainer(
  voice: FakeVoice,
  missingSensor = false,
  repository: MemoryCheckRepository = new MemoryCheckRepository(),
  markedSleep = false,
): AppContainer {
  const clock = new FixedClock(DEMO_NOW);
  const agenda = new StaticAgenda(DEMO_AGENDA);
  const devices = missingSensor
    ? new SimulatedDevices(DEMO_SCENARIOS.missing_sensor, { clock: () => clock.now() })
    : new FakeDevices({});
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices,
    repository,
    agenda,
    clock,
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () =>
      createCheckinRunner({
        recognizer: voice,
        synthesizer: voice,
        devices,
        agenda,
        clock,
        repository,
        evaluate: (state) => {
          const base = evaluateFromState(state, { at: clock.now().toISOString() });
          if (missingSensor) return base;
          return {
            ...base,
            verdict: 'attention',
            actionKey: 'action.slept_little',
            readings: markedSleep ? markSleepDot(base.readings) : base.readings,
          };
        },
        script: checkinScripts.daily,
      }),
    storage: memoryStorage(),
  };
}

/** Shows where the router landed after "Volver a Inicio". */
function HomeProbe() {
  const location = useLocation();
  return <p data-testid="location">{location.pathname}</p>;
}

function renderCheckIn(
  container: AppContainer,
  options: { autostart?: boolean; strict?: boolean; home?: boolean } = {},
) {
  const { autostart = true, strict = false, home = false } = options;
  const tree = (
    <AppServicesProvider services={container}>
      <MemoryRouter initialEntries={[{ pathname: '/checkin', state: autostart ? { autostart: true } : undefined }]}>
        <Switch>
          <Route path="/checkin" component={CheckIn} />
          <Route exact path="/" component={home ? Home : HomeProbe} />
        </Switch>
      </MemoryRouter>
    </AppServicesProvider>
  );
  return render(strict ? <StrictMode>{tree}</StrictMode> : tree);
}

/** The listening indicator and the answer input are shown together while the voice waits. */
async function waitForAnswerInput(): Promise<HTMLInputElement> {
  await screen.findByText(t('checkin.listening'));
  return screen.getByRole('textbox', { name: t('checkin.answerLabel') }) as HTMLInputElement;
}

/** Read-back captions of the confirm steps (confirm.sleep / confirm.mood). */
const sleepReadBack = (hours: number) => t('confirm.sleep', { hours });
const moodReadBack = (mood: number) => t('confirm.mood', { mood });

/** Types an answer, sends it, and waits for the next caption (the runner speaks it before listening). */
async function answer(text: string, nextCaption: string | RegExp): Promise<void> {
  const input = await waitForAnswerInput();
  fireEvent.change(input, { target: { value: text } });
  fireEvent.click(screen.getByRole('button', { name: t('checkin.answerSend') }));
  await screen.findByText(nextCaption);
}

describe('Check-in screen', () => {
  afterEach(() => {
    cleanup();
  });

  it('autostarts: the greeting is captioned, then the sleep question starts listening', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    expect(await screen.findByText(t('greet'))).toBeInTheDocument();
    expect(await screen.findByText(t('ask.sleep'))).toBeInTheDocument();
    expect(await screen.findByText(t('checkin.listening'))).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: t('checkin.answerLabel') })).toBeInTheDocument();
    expect(screen.getByText(t('checkin.step.sleep'))).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: t('checkin.title') })).toBeInTheDocument();
  });

  it('answering siete, sí, cuatro, sí, no and sí through the input reaches the end screen', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    await answer('siete', sleepReadBack(7));
    await answer('sí', t('ask.mood'));
    await answer('cuatro', moodReadBack(4));
    await answer('sí', t('ask.symptoms'));
    await answer('no', /^Lo próximo/);

    const input = await waitForAnswerInput();
    fireEvent.change(input, { target: { value: 'sí' } });
    fireEvent.click(screen.getByRole('button', { name: t('checkin.answerSend') }));

    expect(await screen.findByText(t('checkin.done'))).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: t('checkin.answerLabel') })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('checkin.backHome') })).toBeInTheDocument();
  });

  it.each([
    { answer: 'siete y media', caption: 'Escuché que dormiste 7,5 horas. ¿Es correcto?' },
    { answer: 'una', caption: 'Escuché que dormiste 1 hora. ¿Es correcto?' },
  ])('reads "$answer" back in Spanish as "$caption"', async ({ answer: spoken, caption }) => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    await answer(spoken, caption);
  });

  it('missing sensor: the verdict panel names the sensor and shows no placeholder', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice, true));

    await screen.findByText(t('ask.sleep'));
    await answer('siete', sleepReadBack(7));
    await answer('sí', t('ask.mood'));
    await answer('cuatro', moodReadBack(4));
    await answer('sí', t('ask.symptoms'));
    await answer('no', /^Lo próximo/);

    const action = 'Falta el dato de la presión: repite la medida';
    expect(t('action.missing_data', { sensor: t('sensor.lower.pressure') })).toBe(action);
    expect(await screen.findByText(action)).toBeInTheDocument();
    expect(screen.queryByText(/\{/)).not.toBeInTheDocument();
  });

  it('"Volver a Inicio" after saving navigates to Home', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    await answer('siete', sleepReadBack(7));
    await answer('sí', t('ask.mood'));
    await answer('cuatro', moodReadBack(4));
    await answer('sí', t('ask.symptoms'));
    await answer('no', /^Lo próximo/);
    const input = await waitForAnswerInput();
    fireEvent.change(input, { target: { value: 'sí' } });
    fireEvent.click(screen.getByRole('button', { name: t('checkin.answerSend') }));
    await screen.findByText(t('checkin.done'));

    fireEvent.click(screen.getByRole('button', { name: t('checkin.backHome') }));

    expect(screen.getByTestId('location')).toHaveTextContent('/');
  });

  it('Pausa shows the paused indicator and Sigue hides it', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('checkin.listening'));
    expect(screen.queryByText(t('checkin.paused'))).not.toBeInTheDocument();

    // While paused the mic stays open for "sigue", so the listening indicator remains.
    fireEvent.click(screen.getByRole('button', { name: messages['checkin.pause'] }));
    expect(await screen.findByText(t('checkin.paused'))).toBeInTheDocument();
    expect(screen.getByText(t('checkin.listening'))).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: messages['checkin.resume'] }));
    await waitFor(() => expect(screen.queryByText(t('checkin.paused'))).not.toBeInTheDocument());
    expect(await screen.findByText(t('checkin.listening'))).toBeInTheDocument();
  });

  it('opened without autostart, shows Empezar and starts the check-in on press', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice), { autostart: false });

    expect(screen.queryByText(t('greet'))).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('home.start') }));

    expect(await screen.findByText(t('greet'))).toBeInTheDocument();
    expect(await screen.findByText(t('ask.sleep'))).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('home.start') })).not.toBeInTheDocument();
  });

  it('autostarts once when rendered under StrictMode', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice), { strict: true });

    expect(await screen.findByText(t('ask.sleep'))).toBeInTheDocument();
    expect(voice.spoken.filter((line) => line === t('greet'))).toHaveLength(1);
  });

  it('unmounting while listening stops the recognizer and nothing more is spoken', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const stop = vi.spyOn(voice, 'stop');
    const { unmount } = renderCheckIn(buildContainer(voice));
    await screen.findByText(t('checkin.listening'));

    unmount();
    await Promise.resolve();

    expect(stop).toHaveBeenCalled();
    const spokenAtUnmount = voice.spoken.length;
    voice.answer('siete');
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(voice.spoken.length).toBe(spokenAtUnmount);
  });

  it('Repite speaks the current question again', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('checkin.listening'));
    const before = voice.spoken.filter((line) => line === t('ask.sleep')).length;

    fireEvent.click(screen.getByRole('button', { name: messages['checkin.repeat'] }));

    await waitFor(() =>
      expect(voice.spoken.filter((line) => line === t('ask.sleep')).length).toBe(before + 1),
    );
  });
});

/** Answers the whole daily script with the CA4-style values and closes it with "sí". */
async function completeCheckin(): Promise<void> {
  await screen.findByText(t('ask.sleep'));
  await answer('cinco horas', sleepReadBack(5));
  await answer('sí', t('ask.mood'));
  await answer('cuatro', moodReadBack(4));
  await answer('sí', t('ask.symptoms'));
  await answer('no', /^Lo próximo/);
  const input = await waitForAnswerInput();
  fireEvent.change(input, { target: { value: 'sí' } });
  fireEvent.click(screen.getByRole('button', { name: t('checkin.answerSend') }));
}

describe('Check-in save (T093)', () => {
  afterEach(() => {
    cleanup();
  });

  it('a finished check-in says it was saved and is stored once', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const repository = new MemoryCheckRepository();
    renderCheckIn(buildContainer(voice, false, repository));

    await completeCheckin();

    expect(await screen.findByText('Chequeo guardado')).toBeInTheDocument();
    expect(screen.queryByText(t('checkin.save_failed'))).not.toBeInTheDocument();
    expect(await repository.list()).toHaveLength(1);
  });

  it('when the write fails the screen says the check-in was not saved', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const repository = new MemoryCheckRepository();
    repository.save = () => Promise.reject(new Error('disk full'));
    renderCheckIn(buildContainer(voice, false, repository));

    await completeCheckin();

    expect(await screen.findByText(t('checkin.save_failed'))).toBeInTheDocument();
    expect(screen.queryByText(t('checkin.done'))).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('checkin.backHome') })).toBeInTheDocument();
  });

  it('after saving, going back to Home shows the verdict of today', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    const repository = new MemoryCheckRepository();
    renderCheckIn(buildContainer(voice, false, repository), { home: true });

    await completeCheckin();
    await screen.findByText(t('checkin.done'));
    fireEvent.click(screen.getByRole('button', { name: t('checkin.backHome') }));

    expect(
      await screen.findByText(t('status.today', { verdict: t('status.verdict.attention') })),
    ).toBeInTheDocument();
  });
});

describe('Check-in big buttons (T060)', () => {
  afterEach(() => {
    vi.useRealTimers();
    cleanup();
  });

  it('after two failed listens at ask_sleep the buttons replace the voice; tapping 7 h reads it back', async () => {
    vi.useFakeTimers();
    const voice = new FakeVoice({ mode: 'never_understands' });
    renderCheckIn(buildContainer(voice));

    // The first failed listen only listens again; nothing is offered yet.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_TIMEOUT_MS);
    });
    expect(screen.queryByRole('button', { name: t('checkin.hoursOption', { h: '7' }) })).not.toBeInTheDocument();
    expect(screen.queryByText(t('checkin.buttonsHint'))).not.toBeInTheDocument();

    // The second failed listen shows the sleep buttons and the hint.
    await act(async () => {
      await vi.advanceTimersByTimeAsync(LISTEN_TIMEOUT_MS);
    });
    expect(screen.getByText(t('checkin.buttonsHint'))).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /h$/ })).toHaveLength(33);

    fireEvent.click(screen.getByRole('button', { name: t('checkin.hoursOption', { h: '7' }) }));
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(screen.getByText(t('confirm.sleep', { hours: 7 }))).toBeInTheDocument();
    expect(screen.getByText('Escuché que dormiste 7 horas. ¿Es correcto?')).toBeInTheDocument();
    expect(screen.queryByText(t('checkin.buttonsHint'))).not.toBeInTheDocument();
  });
});

/** Reaches the end of the check-in by answers (sleep 7 h, mood 4, no symptoms). */
async function finishCheckin(): Promise<void> {
  await screen.findByText(t('ask.sleep'));
  await answer('siete', sleepReadBack(7));
  await answer('sí', t('ask.mood'));
  await answer('cuatro', moodReadBack(4));
  await answer('sí', t('ask.symptoms'));
  await answer('no', /^Lo próximo/);
}

describe('Check-in body and team note', () => {
  it('shows the body with five sensor dots beside the conversation', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await screen.findByText(t('ask.sleep'));
    expect(screen.getByRole('img', { name: t('body.fallbackAlt') })).toBeInTheDocument();
    expect(document.querySelectorAll('[data-sensor]')).toHaveLength(5);
  });

  it('the body dots are not tappable on the check-in: no button, five non-interactive images', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await screen.findByText(t('ask.sleep'));
    expect(document.querySelectorAll('button[data-sensor]')).toHaveLength(0);
    expect(document.querySelectorAll('[role="img"][data-sensor]')).toHaveLength(5);
  });

  it('before the verdict the dots are plain identity dots: no level, no status pill', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await screen.findByText(t('ask.sleep'));
    expect(document.querySelectorAll('[data-sensor]')).toHaveLength(5);
    expect(document.querySelectorAll('[data-level]')).toHaveLength(0);
  });

  it('after the verdict every dot carries its level', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await finishCheckin();
    expect(document.querySelectorAll('[data-level]')).toHaveLength(5);
  });

  it('CA3: the sleep dot is focused while Vita asks about sleep', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await screen.findByText(t('ask.sleep'));
    expect(document.querySelector('[data-sensor="sleep"] .sensor-dot__halo')).not.toBeNull();
    expect(document.querySelector('[data-sensor="pulse"] .sensor-dot__halo')).toBeNull();
  });

  it('the sleep dot stays focused while Vita asks about mood', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    await answer('siete', sleepReadBack(7));
    await answer('sí', t('ask.mood'));
    expect(document.querySelector('[data-sensor="sleep"] .sensor-dot__halo')).not.toBeNull();
  });

  it('shows the team-criterion note exactly once when a mark exists on the screen', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' }), false, undefined, true));

    await finishCheckin();
    expect(screen.getAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });

  it('shows no team-criterion note when no element carries the mark', async () => {
    renderCheckIn(buildContainer(new FakeVoice({ mode: 'manual' })));

    await finishCheckin();
    expect(screen.queryByText(messages['team.criterion.note'])).not.toBeInTheDocument();
  });
});

