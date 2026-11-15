import { useId, useState, type ChangeEvent } from 'react';
import {
  setStoredScenarioId,
  type StorageLike,
} from '../../application/use-cases/selectDemoScenario';
import type { CheckRepositoryPort } from '../../application/ports';
import { t } from '../../config/messages.es';
import { DemoScenarioId } from '@base-vital/contracts';

export interface DemoScenarioSelectProps {
  /** The scenario currently in effect. */
  currentId: DemoScenarioId;
  /** Store whose records are cleared when the scenario changes. */
  repository: CheckRepositoryPort;
  /** Called after the scenario has been persisted, cleared and re-seeded. */
  onChanged: (id: DemoScenarioId) => void;
  /** Re-seeds history for the new scenario (wired in T068). */
  reseed?: (id: DemoScenarioId) => Promise<void>;
  /** Storage that keeps the scenario id; defaults to the browser localStorage. */
  storage?: StorageLike;
}

/** The browser localStorage, or undefined when the browser has none or denies access. */
function browserStorage(): StorageLike | undefined {
  try {
    return typeof window !== 'undefined' ? window.localStorage : undefined;
  } catch {
    // Accessing localStorage can throw when storage is disabled by the browser.
    return undefined;
  }
}

/**
 * Demo scenario selector (FR-013). Choosing a different scenario does not switch
 * immediately: an inline warning asks for confirmation. Confirming clears the
 * records, persists the id, re-seeds history and then reports the change.
 */
export function DemoScenarioSelect({
  currentId,
  repository,
  onChanged,
  reseed,
  storage,
}: DemoScenarioSelectProps) {
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
      setStoredScenarioId(pending, storage ?? browserStorage());
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
