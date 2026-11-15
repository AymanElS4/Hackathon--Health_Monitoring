import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { CheckRecord } from '@base-vital/contracts';
import { MemoryCheckRepository } from '../../src/adapters/fakes/MemoryCheckRepository';
import { SCENARIO_STORAGE_KEY } from '../../src/application/use-cases/selectDemoScenario';
import { DemoScenarioSelect } from '../../src/ui/components/DemoScenarioSelect';
import { messages } from '../../src/config/messages.es';

const reading = (sensor: string, value: string) => ({
  sensor,
  level: 'green',
  phase: 'confirmed',
  value,
  outsideNormal: false,
  reason: null,
});

const readings = {
  sleep: reading('sleep', '7,5 h'),
  pulse: reading('pulse', '62 bpm'),
  pressure: reading('pressure', '112/72'),
  temperature: reading('temperature', '36,7 °C'),
  oxygen: reading('oxygen', '98 %'),
};

const RECORD_ID = '2026-11-15T07:00:00.000Z';

const validRecord = (): CheckRecord =>
  ({
    id: RECORD_ID,
    observations: [
      {
        indicator: 'resting_heart_rate',
        value: 62,
        source: 'device',
        confirmed: true,
        simulated: true,
        at: RECORD_ID,
      },
    ],
    symptoms: ['none'],
    readings,
    verdict: 'ok',
    actionKey: 'action.ok',
    simulated: true,
  }) as CheckRecord;

const LABEL = messages['scenario.title'];

describe('DemoScenarioSelect', () => {
  let repository: MemoryCheckRepository;

  afterEach(() => {
    cleanup();
  });

  beforeEach(async () => {
    window.localStorage.clear();
    repository = new MemoryCheckRepository();
    await repository.save(validRecord());
  });

  it('renders a labelled select with the five scenarios', () => {
    render(
      <DemoScenarioSelect currentId="normal" repository={repository} onChanged={vi.fn()} />,
    );

    const select = screen.getByLabelText(LABEL) as HTMLSelectElement;
    expect(select.value).toBe('normal');
    const options = [...select.options].map((option) => [option.value, option.textContent]);
    expect(options).toEqual([
      ['normal', messages['scenario.normal']],
      ['ca4', messages['scenario.ca4']],
      ['missing_sensor', messages['scenario.missing_sensor']],
      ['low_temp', messages['scenario.low_temp']],
      ['voice_not_understood', messages['scenario.voice_not_understood']],
    ]);
  });

  it('selecting a different scenario shows the warning and does not clear yet', async () => {
    const onChanged = vi.fn();
    render(
      <DemoScenarioSelect currentId="normal" repository={repository} onChanged={onChanged} />,
    );

    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: 'ca4' } });

    expect(screen.getByText(messages['scenario.resetWarning'])).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages['scenario.confirm'] })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: messages['scenario.cancel'] })).toBeInTheDocument();
    expect(await repository.list()).toHaveLength(1);
    expect(onChanged).not.toHaveBeenCalled();
  });

  it('cancel keeps the record, hides the warning and reverts the select', async () => {
    const onChanged = vi.fn();
    render(
      <DemoScenarioSelect currentId="normal" repository={repository} onChanged={onChanged} />,
    );

    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: 'low_temp' } });
    fireEvent.click(screen.getByRole('button', { name: messages['scenario.cancel'] }));

    expect(screen.queryByText(messages['scenario.resetWarning'])).not.toBeInTheDocument();
    expect((screen.getByLabelText(LABEL) as HTMLSelectElement).value).toBe('normal');
    expect(await repository.list()).toHaveLength(1);
    expect(onChanged).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(SCENARIO_STORAGE_KEY)).toBeNull();
  });

  it('confirm clears the repository, persists, re-seeds and reports the new id', async () => {
    const onChanged = vi.fn();
    const reseed = vi.fn(async () => {});
    render(
      <DemoScenarioSelect
        currentId="normal"
        repository={repository}
        onChanged={onChanged}
        reseed={reseed}
      />,
    );

    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: 'ca4' } });
    fireEvent.click(screen.getByRole('button', { name: messages['scenario.confirm'] }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('ca4'));
    expect(await repository.list()).toEqual([]);
    expect(reseed).toHaveBeenCalledWith('ca4');
    expect(window.localStorage.getItem(SCENARIO_STORAGE_KEY)).toBe('ca4');
    expect(screen.queryByText(messages['scenario.resetWarning'])).not.toBeInTheDocument();
  });

  it('works without a reseed callback', async () => {
    const onChanged = vi.fn();
    render(
      <DemoScenarioSelect currentId="normal" repository={repository} onChanged={onChanged} />,
    );

    fireEvent.change(screen.getByLabelText(LABEL), { target: { value: 'missing_sensor' } });
    fireEvent.click(screen.getByRole('button', { name: messages['scenario.confirm'] }));

    await waitFor(() => expect(onChanged).toHaveBeenCalledWith('missing_sensor'));
    expect(await repository.list()).toEqual([]);
  });
});
