/**
 * Tests for the check-in as a chat with Vita (T080a). The screen is built from fakes and the real
 * runner, as in checkInScreen.test.tsx. Covers the transcript order, the confirmations with value
 * and unit, the quick replies (same events as voice), Pausa/Seguir, aria-labels, progress, the
 * live bubble, and the verdict as Vita's last message.
 */
import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter, Route, Switch } from 'react-router-dom';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { CheckIn } from '../../src/ui/screens/CheckIn';
import { MicIndicator } from '../../src/ui/components/chat/MicIndicator';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import { createCheckinRunner, type CheckinRunner } from '../../src/application/use-cases/runCheckin';
import { evaluateFromState } from '../../src/application/use-cases/evaluateFromState';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { checkinScripts } from '../../src/config/checkinScripts';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { LISTEN_TIMEOUT_MS } from '../../src/config/constants';
import { messages, t } from '../../src/config/messages.es';
import type { CheckinEvent } from '../../src/domain/checkin/types';

/** Local 09:20 on the demo day: the agenda's next item is "Chequeo diario" at 09:30. */
const DEMO_NOW = new Date(2026, 10, 15, 9, 20);

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

/** Records the runner the screen creates and every event dispatched to it. */
interface Probe {
  runner?: CheckinRunner;
  events: CheckinEvent[];
}

/** Container with the real runner and the daily script; `probe` sees the runner and its events. */
function buildContainer(voice: FakeVoice, probe: Probe = { events: [] }): AppContainer {
  const clock = new FixedClock(DEMO_NOW);
  const agenda = new StaticAgenda(DEMO_AGENDA);
  const devices = new FakeDevices({});
  const repository = new MemoryCheckRepository();
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
    createCheckinRunner: () => {
      const runner = createCheckinRunner({
        recognizer: voice,
        synthesizer: voice,
        devices,
        agenda,
        clock,
        repository,
        evaluate: (state) => ({
          ...evaluateFromState(state, { at: clock.now().toISOString() }),
          verdict: 'attention',
          actionKey: 'action.slept_little',
        }),
        script: checkinScripts.daily,
      });
      probe.runner = runner;
      return {
        ...runner,
        dispatch: (event: CheckinEvent) => {
          probe.events.push(event);
          return runner.dispatch(event);
        },
      };
    },
    storage: {
      getItem: () => null,
      setItem: () => undefined,
    },
  } as unknown as AppContainer;
}

function renderCheckIn(container: AppContainer) {
  return render(
    <AppServicesProvider services={container}>
      <MemoryRouter initialEntries={[{ pathname: '/checkin', state: { autostart: true } }]}>
        <Switch>
          <Route path="/checkin" component={CheckIn} />
        </Switch>
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

/** Waits until the voice listens (the mic indicator says so). */
async function listening(): Promise<void> {
  await screen.findByText(t('checkin.listening'));
}

/** Answers the voice and waits for the next line of Vita to appear in the transcript. */
async function say(text: string, nextLine: string | RegExp, voice: FakeVoice): Promise<void> {
  await listening();
  voice.answer(text);
  await screen.findByText(nextLine);
}

/** The text of the transcript, in document order: one entry per message bubble or verdict. */
function transcriptText(): string {
  return screen.getByRole('log').textContent ?? '';
}

describe('Check-in chat: transcript', () => {
  it('a full scripted check-in lists every message in order, the verdict last', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    await say('sí', t('ask.mood'), voice);
    await say('cuatro', t('confirm.mood', { mood: 4 }), voice);
    await say('sí', t('ask.symptoms'), voice);
    await say('no', /^Lo próximo/, voice);
    // The next activity is confirmed with the Sí chip, which saves the check.
    await listening();
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await screen.findByRole('button', { name: t('checkin.backHome') });

    const expected = [
      t('greet'),
      t('ask.sleep'),
      '5 horas',
      t('confirm.sleep', { hours: 5 }),
      t('checkin.yes'),
      t('ask.mood'),
      '4 de 5',
      t('confirm.mood', { mood: 4 }),
      t('checkin.yes'),
      t('ask.symptoms'),
      'Ninguno',
      t('measure'),
      t('status.verdict.attention'),
      t('action.slept_little'),
      'Lo próximo',
      t('checkin.yes'),
    ];
    const text = transcriptText();
    let from = 0;
    for (const line of expected) {
      const at = text.indexOf(line, from);
      expect(at, `"${line}" missing or out of order`).toBeGreaterThanOrEqual(from);
      from = at + line.length;
    }
    // Nothing but the save block follows Ana's "sí" to the next activity.
    expect(text.slice(from)).toBe('Chequeo guardadoVolver al inicioHistorial');
  });

  it('the verdict is the last message and the save button sits after it', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    await say('sí', t('ask.mood'), voice);
    await say('cuatro', t('confirm.mood', { mood: 4 }), voice);
    await say('sí', t('ask.symptoms'), voice);
    await say('no', /^Lo próximo/, voice);
    await listening();
    voice.answer('sí');
    const back = await screen.findByRole('button', { name: t('checkin.backHome') });

    expect(back.textContent).toBe(t('checkin.backHome'));
    const badge = screen.getByText(t('status.verdict.attention'));
    expect(badge.compareDocumentPosition(back) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole('button', { name: t('checkin.backHome') })).toBeInTheDocument();
    expect(screen.getAllByText(t('status.verdict.attention'))).toHaveLength(1);
  });

  it('auto-scrolls to the newest message when the screen can scroll (guarded for jsdom)', async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    expect(scroll).toHaveBeenCalled();
    delete (Element.prototype as Partial<Element>).scrollIntoView;
  });
});

describe('Check-in chat: confirmations and live answer', () => {
  it('the sleep confirmation names the value and unit, with the hint "Di «sí» o «no»"', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', 'Escuché que dormiste 5 horas. ¿Es correcto?', voice);
    expect(screen.getByText('Escuché que dormiste 5 horas. ¿Es correcto?')).toBeInTheDocument();
    expect(screen.getByText(messages['checkin.confirmHint'])).toBeInTheDocument();
    expect(messages['checkin.confirmHint']).toBe('Di «sí» o «no»');
  });

  it('the mood confirmation names the mood and the scale', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voice);
    await say('sí', t('ask.mood'), voice);
    await say('cuatro', 'Escuché que tu ánimo es 4 de 5. ¿Es correcto?', voice);
    expect(screen.getByText('Escuché que tu ánimo es 4 de 5. ¿Es correcto?')).toBeInTheDocument();
  });

  it('a single hour reads naturally: "Escuché que dormiste 1 hora. ¿Es correcto?"', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('una', 'Escuché que dormiste 1 hora. ¿Es correcto?', voice);
  });

  it('the heard value is a dashed live bubble until "sí", then a solid Ana bubble', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    const live = screen.getByText('5 horas…');
    expect(live).toHaveClass('border-dashed');

    await say('sí', t('ask.mood'), voice);
    const solid = screen.getByText('5 horas');
    expect(solid).toHaveClass('bg-primary');
    expect(screen.queryByText('5 horas…')).not.toBeInTheDocument();
  });

  it('Vita\'s lines are on the left, Ana\'s answers on the right', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    const vitaLine = screen.getByText(t('ask.sleep'));
    expect(vitaLine).toHaveClass('bg-card');
    expect(vitaLine.parentElement?.parentElement).toHaveClass('items-end');
    const anaLine = screen.getByText('5 horas…');
    expect(anaLine.parentElement).toHaveClass('justify-end');
  });
});

describe('Check-in chat: next activity', () => {
  it('when Vita says "Lo próximo", the Sí chip and the hint show under the verdict', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    await say('sí', t('ask.mood'), voice);
    await say('cuatro', t('confirm.mood', { mood: 4 }), voice);
    await say('sí', t('ask.symptoms'), voice);
    await say('no', /^Lo próximo/, voice);

    expect(await screen.findByRole('button', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByText('Di «sí» para terminar')).toBeInTheDocument();
    expect(screen.queryByText(messages['checkin.confirmHint'])).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'No' })).not.toBeInTheDocument();
  });
});

describe('Check-in chat: quick replies', () => {
  it('the sleep confirmation offers 👍 Sí and 👎 No, as accessible names "Sí" and "No"', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí' }).textContent).toContain('👍');
    expect(screen.getByRole('button', { name: 'No' }).textContent).toContain('👎');
  });

  it('the mood question offers five chips, each with its digit and word', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voice);
    await say('sí', t('ask.mood'), voice);
    for (let mood = 1; mood <= 5; mood += 1) {
      const chip = screen.getByRole('button', { name: t(`checkin.moodOption.${mood}`) });
      expect(chip.textContent).toContain(String(mood));
    }
    expect(screen.getAllByRole('button', { name: /^(muy mal|mal|regular|bien|muy bien)$/ })).toHaveLength(5);
  });

  it('the symptom question offers 5 chips: Ninguno · Mareo · Desmayo · Dolor de pecho · Falta de aire', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voice);
    await say('sí', t('ask.mood'), voice);
    await say('cuatro', 'Escuché que tu ánimo es 4 de 5. ¿Es correcto?', voice);
    await say('sí', t('ask.symptoms'), voice);

    const chips = ['Ninguno', 'Mareo', 'Desmayo', 'Dolor de pecho', 'Falta de aire'];
    for (const name of chips) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
    expect(screen.queryByRole('button', { name: 'Otro' })).not.toBeInTheDocument();
  });

  it('a chip dispatches what the voice would: the same resulting snapshot as the spoken answer', async () => {
    // Voice path: "sí" is spoken at the sleep confirmation.
    const voiceA = new FakeVoice({ mode: 'manual' });
    const probeA: Probe = { events: [] };
    const first = renderCheckIn(buildContainer(voiceA, probeA));
    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voiceA);
    voiceA.answer('sí');
    await screen.findByText(t('ask.mood'));
    const viaVoice = probeA.runner!.getSnapshot();
    first.unmount();

    // Chip path: the same step, tapped on the chip.
    const voiceB = new FakeVoice({ mode: 'manual' });
    const probeB: Probe = { events: [] };
    renderCheckIn(buildContainer(voiceB, probeB));
    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voiceB);
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));
    await screen.findByText(t('ask.mood'));
    const viaChip = probeB.runner!.getSnapshot();

    expect(viaChip.step).toBe(viaVoice.step);
    expect(viaChip.confirmedVoice).toEqual(viaVoice.confirmedVoice);
    expect(viaChip.spoken.map((line) => line.text)).toEqual(viaVoice.spoken.map((line) => line.text));
    expect(probeB.events.at(-1)).toEqual({ type: 'buttonAnswer', text: t('checkin.yes') });
  });

  it('the mood chip "bien" gives the same answer as saying "cuatro"', async () => {
    const voiceA = new FakeVoice({ mode: 'manual' });
    const probeA: Probe = { events: [] };
    const first = renderCheckIn(buildContainer(voiceA, probeA));
    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voiceA);
    await say('sí', t('ask.mood'), voiceA);
    voiceA.answer('cuatro');
    await screen.findByText('Escuché que tu ánimo es 4 de 5. ¿Es correcto?');
    const viaVoice = probeA.runner!.getSnapshot();
    first.unmount();

    const voiceB = new FakeVoice({ mode: 'manual' });
    const probeB: Probe = { events: [] };
    renderCheckIn(buildContainer(voiceB, probeB));
    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voiceB);
    await say('sí', t('ask.mood'), voiceB);
    fireEvent.click(screen.getByRole('button', { name: t('checkin.moodOption.4') }));
    await screen.findByText('Escuché que tu ánimo es 4 de 5. ¿Es correcto?');
    const viaChip = probeB.runner!.getSnapshot();

    expect(viaChip.pending).toEqual(viaVoice.pending);
    expect(viaChip.step).toBe(viaVoice.step);
    expect(viaChip.spoken.map((line) => line.text)).toEqual(viaVoice.spoken.map((line) => line.text));
  });

  it('the quick replies leave when the voice stops listening (paused hides them)', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);
    expect(screen.getByRole('button', { name: 'Sí' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: t('checkin.pause') }));
    await screen.findByText(t('checkin.paused'));
    expect(screen.queryByRole('button', { name: 'Sí' })).not.toBeInTheDocument();
  });
});

/** A voice whose speech never ends once `hold` is set: Vita stays "speaking" (T080a). */
class HoldingVoice extends FakeVoice {
  hold = false;

  speak(text: string): Promise<void> {
    if (!this.hold) return super.speak(text);
    this.spoken.push(text);
    return new Promise<void>(() => undefined);
  }
}

describe('Check-in chat: a chip answer closes the open listen', () => {
  it('after a chip tap the voice is not listening, Vita is speaking, and no chips show until the next listen', async () => {
    const voice = new HoldingVoice({ mode: 'manual' });
    const probe: Probe = { events: [] };
    renderCheckIn(buildContainer(voice, probe));

    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voice);
    voice.hold = true;
    fireEvent.click(screen.getByRole('button', { name: 'Sí' }));

    await screen.findByText(t('ask.mood'));
    expect(probe.runner!.getSnapshot().listening).toBe(false);
    expect(await screen.findByText(t('checkin.speaking'))).toBeInTheDocument();
    expect(screen.queryByText(t('checkin.listening'))).not.toBeInTheDocument();
    for (let mood = 1; mood <= 5; mood += 1) {
      expect(screen.queryByRole('button', { name: t(`checkin.moodOption.${mood}`) })).not.toBeInTheDocument();
    }
  });
});

describe('Check-in chat: controls, progress and body', () => {
  it('Pausa is replaced by Seguir while paused, and Seguir brings Pausa back', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));
    await listening();

    expect(screen.getByRole('button', { name: 'Pausa' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Seguir' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Pausa' }));
    await screen.findByText(t('checkin.paused'));
    expect(screen.getByRole('button', { name: 'Seguir' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Pausa' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(await screen.findByRole('button', { name: 'Pausa' })).toBeInTheDocument();
  });

  it('the controls have their words as accessible names and the emoji is hidden', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));
    await listening();

    const pause = screen.getByRole('button', { name: 'Pausa' });
    const repeat = screen.getByRole('button', { name: 'Repetir' });
    expect(pause).toHaveAttribute('aria-label', 'Pausa');
    expect(repeat).toHaveAttribute('aria-label', 'Repetir');
    expect(pause.querySelector('[aria-hidden="true"]')).not.toBeNull();
    expect(screen.getByText(messages['checkin.controlsHint'])).toBeInTheDocument();
    expect(messages['checkin.controlsHint']).toBe('También puedes decir «para» o «repite»');
  });

  it('every button on the check-in has an accessible name', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));
    await say('cinco horas', t('confirm.sleep', { hours: 5 }), voice);

    for (const button of screen.getAllByRole('button')) {
      expect(button.getAttribute('aria-label') ?? button.textContent, button.outerHTML).toBeTruthy();
    }
  });

  it('progress reads "Pregunta n de 3 · tema" for the three questions', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    expect(await screen.findByText(`Pregunta 1 de 3 · ${t('checkin.step.sleep')}`)).toBeInTheDocument();
    await say('siete', 'Escuché que dormiste 7 horas. ¿Es correcto?', voice);
    await say('sí', t('ask.mood'), voice);
    expect(screen.getByText(`Pregunta 2 de 3 · ${t('checkin.step.mood')}`)).toBeInTheDocument();
    expect(screen.getByRole('progressbar', { name: t('checkin.progressLabel') })).toHaveAttribute(
      'aria-valuenow',
      '2',
    );
  });

  it('the body names the sensor in focus under it ("Sueño")', async () => {
    const voice = new FakeVoice({ mode: 'manual' });
    renderCheckIn(buildContainer(voice));

    await screen.findByText(t('ask.sleep'));
    expect(screen.getByText(t('sensor.sleep'))).toBeInTheDocument();
  });

  it('the mic shows "Te escucho…" while listening, and "Vita está hablando…" in grey while speaking', () => {
    const { rerender } = render(<MicIndicator listening speaking={false} />);
    const listeningLabel = screen.getByText(t('checkin.listening'));
    expect(listeningLabel.closest('p')).toHaveClass('text-primary');
    expect(document.querySelector('.motion-safe\\:animate-sensor-pulse')).not.toBeNull();

    rerender(<MicIndicator listening={false} speaking />);
    const speakingLabel = screen.getByText(t('checkin.speaking'));
    expect(speakingLabel.closest('p')).toHaveClass('text-ink-secondary');
    expect(within(speakingLabel.closest('p') as HTMLElement).queryByText(t('checkin.listening'))).toBeNull();
  });
});

describe('Check-in chat: fallback buttons', () => {
  it('after two failed listens, the fallback options use the same chip style, large', async () => {
    vi.useFakeTimers();
    try {
      const voice = new FakeVoice({ mode: 'never_understands' });
      renderCheckIn(buildContainer(voice));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(2 * LISTEN_TIMEOUT_MS);
      });
      const option = screen.getByRole('button', { name: t('checkin.hoursOption', { h: '7' }) });
      expect(option).toHaveClass('min-h-touch');
      expect(option).toHaveClass('py-md');
    } finally {
      vi.useRealTimers();
    }
  });
});
