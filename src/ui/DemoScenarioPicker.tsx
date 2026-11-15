import { useId, useState, type ChangeEvent } from 'react';
import { setStoredScenarioId } from '../application/container';
import type { CheckRepositoryPort } from '../application/ports';
import { t } from '../config/messages.es';
import { DemoScenarioId } from '../contracts';

export interface DemoScenarioPickerProps {
  /** The scenario currently in effect. */
  currentId: DemoScenarioId;
  /** Store whose records are cleared when the scenario changes. */
  repository: CheckRepositoryPort;
  /** Called after the scenario has been persisted, cleared and re-seeded. */
  onChanged: (id: DemoScenarioId) => void;
  /** Re-seeds history for the new scenario (wired in T068). */
  reseed?: (id: DemoScenarioId) => Promise<void>;
}

/**
 * Demo scenario selector (FR-013). Choosing a different scenario does not switch
 * immediately: an inline warning asks for confirmation. Confirming clears the
 * records, persists the id, re-seeds history and then reports the change.
 */
export function DemoScenarioPicker({
  currentId,
  repository,
  onChanged,
  reseed,
}: DemoScenarioPickerProps) {
  const selectId = useId();
  const [pending, setPending] = useState<DemoScenarioId | null>(null);
  const [busy, setBusy] = useState(false);

  const handleChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const next = DemoScenarioId.parse(event.target.value);
    setPending(next === currentId ? null : next);
  };

  const handleConfirm = async () => {
    if (pending === null) return;
    setBusy(true);
    try {
      await repository.clear();
      setStoredScenarioId(pending);
      await reseed?.(pending);
      setPending(null);
      onChanged(pending);
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = () => {
    setPending(null);
  };

  return (
    <div>
      <label htmlFor={selectId}>{t('scenario.title')}</label>
      <select
        id={selectId}
        value={pending ?? currentId}
        disabled={busy}
        onChange={handleChange}
      >
        {DemoScenarioId.options.map((id) => (
          <option key={id} value={id}>
            {t(`scenario.${id}`)}
          </option>
        ))}
      </select>
      {pending !== null && (
        <div role="alert">
          <p>{t('scenario.resetWarning')}</p>
          <button type="button" onClick={handleConfirm} disabled={busy}>
            {t('scenario.confirm')}
          </button>
          <button type="button" onClick={handleCancel} disabled={busy}>
            {t('scenario.cancel')}
          </button>
        </div>
      )}
    </div>
  );
}
