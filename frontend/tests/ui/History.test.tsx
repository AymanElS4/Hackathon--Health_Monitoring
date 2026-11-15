/**
 * Tests for the history screen (T092, US6, CA8, HU6). Written before the screen; must FAIL until
 * `src/ui/screens/History.tsx` exists and renders the contract below.
 *
 * Expected API:
 *
 *   History()                       // no props. Reads `repository.list()` from AppServices
 *                                   // (newest first) and renders one row per CheckRecord.
 *
 * Per record, the screen renders one `<li data-testid="history-record">` that contains:
 *   - `<time datetime={record.id}>` with the date of the check;
 *   - the verdict label `t('status.verdict.<verdict>')`;
 *   - each observation's value formatted with `t('value.<indicator>', ...)`, followed by its
 *     source label: `t('history.source.voice')` for voice, `t('history.source.device')` for device;
 *   - the tag `t('history.simulated')` (exact text) only when `record.simulated` is true;
 *   - mood values as one text "<value>*" (`t('team.criterion.mark')` appended), see below.
 * `team.criterion.note` is rendered once for the whole screen (Principle VIII, spec clarification).
 * With no records the screen shows `t('history.empty')` and no rows.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import {
  CheckRecord,
  type Observation,
  type SensorKey,
  type SensorReading,
  type Verdict,
} from '@base-vital/contracts';
import { AppServicesProvider, type AppContainer } from '../../src/ui/AppServices';
import { History } from '../../src/ui/screens/History';
import { FakeVoice } from '../../src/adapters/fakes/FakeVoice';
import { FakeDevices } from '../../src/adapters/fakes/FakeDevices';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';
import { FixedClock } from '../../src/adapters/fakes/FixedClock';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { StaticAgenda } from '../../src/adapters/static-agenda/StaticAgenda';
import type { StorageLike } from '../../src/application/use-cases/selectDemoScenario';
import { DEMO_AGENDA } from '../../src/config/agenda';
import { DEMO_SCENARIOS } from '../../src/config/demoScenarios';
import { messages, t } from '../../src/config/messages.es';

/** Local 09:40 on the demo day: today's check is saved at 09:31. */
const DEMO_NOW = new Date(2026, 10, 15, 9, 40);
const ROW_TESTID = 'history-record';

const SENSORS: SensorKey[] = ['sleep', 'pulse', 'pressure', 'temperature', 'oxygen'];

function memoryStorage(): StorageLike {
  const data = new Map<string, string>();
  return {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => {
      data.set(key, String(value));
    },
  };
}

function buildContainer(repository: MemoryCheckRepository): AppContainer {
  const clock = new FixedClock(DEMO_NOW);
  const voice = new FakeVoice({ mode: 'manual' });
  return {
    scenario: DEMO_SCENARIOS.normal,
    devices: new FakeDevices({}),
    repository,
    agenda: new StaticAgenda(DEMO_AGENDA),
    clock,
    connectivity: new FakeConnectivity(true),
    voiceMode: 'fake',
    recognizer: voice,
    synthesizer: voice,
    createCheckinRunner: () => {
      throw new Error('the check-in runner is not used by the History tests');
    },
    storage: memoryStorage(),
  };
}

function renderHistory(repository: MemoryCheckRepository) {
  return render(
    <AppServicesProvider services={buildContainer(repository)}>
      <MemoryRouter initialEntries={['/historial']}>
        <History />
      </MemoryRouter>
    </AppServicesProvider>,
  );
}

/** Local 09:31 on the given day of November 2026, as an ISO date-time (the record id). */
function savedAt(day: number): string {
  return new Date(2026, 10, day, 9, 31).toISOString();
}

function readings(): Record<SensorKey, SensorReading> {
  return Object.fromEntries(
    SENSORS.map((sensor) => [
      sensor,
      { sensor, level: 'green', phase: 'confirmed', value: '—', outsideNormal: false, teamCriterion: false, reason: null },
    ]),
  ) as Record<SensorKey, SensorReading>;
}

/** Voice values (sleep, mood): confirmed by the person, so `simulated` is false. */
function voiceObservations(at: string, sleepHours: number, mood: number): Observation[] {
  return [
    { indicator: 'sleep_hours', value: sleepHours, source: 'voice', confirmed: true, simulated: false, at },
    { indicator: 'mood', value: mood, source: 'voice', confirmed: true, simulated: false, at },
  ];
}

/** Device values: `simulated` is true for every device value in this version (data-model.md). */
function deviceObservations(at: string): Observation[] {
  return [
    { indicator: 'resting_heart_rate', value: 72, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'blood_pressure', value: { systolic: 118, diastolic: 76 }, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'body_temperature', value: 36.6, source: 'device', confirmed: true, simulated: true, at },
    { indicator: 'oxygen_saturation', value: 98, source: 'device', confirmed: true, simulated: true, at },
  ];
}

/** The real check of today: voice-confirmed sleep and mood, device vitals, not simulated. */
function todayRecord(): CheckRecord {
  const at = new Date(2026, 10, 15, 9, 31).toISOString();
  return CheckRecord.parse({
    id: at,
    observations: [...voiceObservations(at, 7.5, 4), ...deviceObservations(at)],
    symptoms: ['none'],
    readings: readings(),
    verdict: 'ok',
    actionKey: '',
    simulated: false,
  });
}

/** One of the 14 seeded history days (simulated), with the given verdict and values. */
function seededRecord(day: number, verdict: Verdict, sleepHours: number, mood: number): CheckRecord {
  const at = savedAt(day);
  return CheckRecord.parse({
    id: at,
    observations: [...voiceObservations(at, sleepHours, mood), ...deviceObservations(at)],
    symptoms: ['none'],
    readings: readings(),
    verdict,
    actionKey: verdict === 'ok' ? '' : 'action.single_amber',
    simulated: true,
  });
}

/** Saved out of order on purpose: the screen must sort them, newest first. */
async function seededRepository(): Promise<MemoryCheckRepository> {
  const repository = new MemoryCheckRepository();
  await repository.save(seededRecord(12, 'alert', 4, 2));
  await repository.save(todayRecord());
  await repository.save(seededRecord(14, 'ok', 8, 4));
  await repository.save(seededRecord(13, 'attention', 5.5, 3));
  return repository;
}

/** The rows are read from the screen, so the tests see what the user sees. */
function rows(): HTMLElement[] {
  return screen.getAllByTestId(ROW_TESTID);
}

function rowDate(row: HTMLElement): string | null {
  return row.querySelector('time')?.getAttribute('datetime') ?? null;
}

/** The row of a record, found by its id (its ISO date-time). */
function rowOf(id: string): HTMLElement {
  const row = rows().find((candidate) => rowDate(candidate) === id);
  if (!row) throw new Error(`no history row for ${id}`);
  return row;
}

/** Mood is a team criterion: the value is followed by the mark, e.g. "4*". */
function moodText(value: number): string {
  return `${t('value.mood', { value })}${t('team.criterion.mark')}`;
}

describe('History screen (T092, US6)', () => {
  afterEach(() => {
    cleanup();
  });

  it('lists the records newest first', async () => {
    renderHistory(await seededRepository());

    await waitFor(() => expect(rows()).toHaveLength(4));
    expect(rows().map(rowDate)).toEqual([savedAt(15), savedAt(14), savedAt(13), savedAt(12)]);
  });

  it('shows each value with its source: "voz" for voice values, "equipo" for device values', async () => {
    renderHistory(await seededRepository());
    await waitFor(() => expect(rows()).toHaveLength(4));

    const today = within(rowOf(savedAt(15)));
    // Today: sleep and mood by voice, four vitals by device.
    expect(today.getByText(t('value.sleep_hours', { value: 7.5 }))).toBeInTheDocument();
    expect(today.getByText(t('value.resting_heart_rate', { value: 72 }))).toBeInTheDocument();
    expect(today.getByText(t('value.blood_pressure', { systolic: 118, diastolic: 76 }))).toBeInTheDocument();
    expect(today.getByText(t('value.body_temperature', { value: 36.6 }))).toBeInTheDocument();
    expect(today.getByText(t('value.oxygen_saturation', { value: 98 }))).toBeInTheDocument();
    expect(today.getAllByText(t('history.source.voice'))).toHaveLength(2);
    expect(today.getAllByText(t('history.source.device'))).toHaveLength(4);

    // Every row: two voice values (sleep, mood) and four device values.
    for (const id of [savedAt(14), savedAt(13), savedAt(12)]) {
      const row = within(rowOf(id));
      expect(row.getAllByText(t('history.source.voice'))).toHaveLength(2);
      expect(row.getAllByText(t('history.source.device'))).toHaveLength(4);
    }
  });

  it('marks only the seeded records with "simulado"', async () => {
    renderHistory(await seededRepository());
    await waitFor(() => expect(rows()).toHaveLength(4));

    expect(within(rowOf(savedAt(15))).queryByText(t('history.simulated'))).not.toBeInTheDocument();
    for (const id of [savedAt(14), savedAt(13), savedAt(12)]) {
      expect(within(rowOf(id)).getByText(t('history.simulated'))).toBeInTheDocument();
    }
    expect(screen.getAllByText(t('history.simulated'))).toHaveLength(3);
  });

  it('shows the verdict label of each record', async () => {
    renderHistory(await seededRepository());
    await waitFor(() => expect(rows()).toHaveLength(4));

    expect(within(rowOf(savedAt(15))).getByText(t('status.verdict.ok'))).toBeInTheDocument();
    expect(within(rowOf(savedAt(14))).getByText(t('status.verdict.ok'))).toBeInTheDocument();
    expect(within(rowOf(savedAt(13))).getByText(t('status.verdict.attention'))).toBeInTheDocument();
    expect(within(rowOf(savedAt(12))).getByText(t('status.verdict.alert'))).toBeInTheDocument();
  });

  it('marks every mood value with "*"', async () => {
    renderHistory(await seededRepository());
    await waitFor(() => expect(rows()).toHaveLength(4));

    expect(within(rowOf(savedAt(15))).getByText(moodText(4))).toBeInTheDocument();
    expect(within(rowOf(savedAt(14))).getByText(moodText(4))).toBeInTheDocument();
    expect(within(rowOf(savedAt(13))).getByText(moodText(3))).toBeInTheDocument();
    expect(within(rowOf(savedAt(12))).getByText(moodText(2))).toBeInTheDocument();
  });

  it('shows the team criterion note exactly once on the screen', async () => {
    renderHistory(await seededRepository());
    await waitFor(() => expect(rows()).toHaveLength(4));

    expect(screen.getAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });

  it('shows an empty-state message and no rows when the repository is empty', async () => {
    renderHistory(new MemoryCheckRepository());

    expect(await screen.findByText(t('history.empty'))).toBeInTheDocument();
    expect(screen.queryAllByTestId(ROW_TESTID)).toHaveLength(0);
    // The demo metrics draw team bands, so the note is shown once even with no records.
    expect(await screen.findAllByText(messages['team.criterion.note'])).toHaveLength(1);
  });

  it('says the history cannot be read when the repository fails, not that it is empty', async () => {
    const repository = new MemoryCheckRepository();
    repository.list = () => Promise.reject(new Error('database unavailable'));
    renderHistory(repository);

    expect(await screen.findByText(t('history.load_failed'))).toBeInTheDocument();
    expect(screen.queryByText(t('history.empty'))).not.toBeInTheDocument();
    expect(screen.queryAllByTestId(ROW_TESTID)).toHaveLength(0);
  });

  it('shows the team criterion note exactly once when no mood value is on screen', async () => {
    const at = savedAt(15);
    const repository = new MemoryCheckRepository();
    await repository.save(
      CheckRecord.parse({
        id: at,
        observations: deviceObservations(at),
        symptoms: ['none'],
        readings: readings(),
        verdict: 'ok',
        actionKey: '',
        simulated: false,
      }),
    );
    renderHistory(repository);

    await waitFor(() => expect(rows()).toHaveLength(1));
    expect(await screen.findAllByText(messages['team.criterion.note'])).toHaveLength(1);
    expect(screen.queryByText(moodText(4))).not.toBeInTheDocument();
  });
});
