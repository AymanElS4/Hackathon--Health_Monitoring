import { useSyncExternalStore } from 'react';
import {
  checkTargets,
  type DevMetricKey,
  type DevMetricsRecorder,
  type TargetResult,
} from '../../application/devMetrics';
import { MS_PER_SECOND } from '../../config/constants';
import { t } from '../../config/messages.es';

const LABEL_KEY: Record<DevMetricKey, string> = {
  checkin: 'dev.checkin',
  voiceStart: 'dev.voiceStart',
  finalTranscript: 'dev.finalTranscript',
  fps: 'dev.fps',
};

/** Milliseconds as text: "850 ms" below a second, "41,2 s" from one second up. */
function formatMs(ms: number): string {
  if (ms < MS_PER_SECOND) return t('dev.unit.ms', { value: Math.round(ms) });
  return t('dev.unit.s', { value: ms / MS_PER_SECOND });
}

function valueText(result: TargetResult): string {
  if (result.value === null) return t('dev.notMeasured');
  return result.metric === 'fps' ? t('dev.unit.fps', { value: Math.round(result.value) }) : formatMs(result.value);
}

function targetText(result: TargetResult): string {
  if (result.metric === 'fps') return t('dev.targetMin', { value: t('dev.unit.fps', { value: result.target }) });
  return t('dev.targetMax', { value: formatMs(result.target) });
}

function metText(result: TargetResult): string {
  if (result.met === null) return t('dev.notMeasured');
  return result.met ? t('dev.met') : t('dev.notMet');
}

/**
 * Dev-only overlay (T095): the last check-in run and the 3D frame rate against the plan.md targets.
 * Mounted only when `devMetricsVisible` says so; the caller lazy-loads it.
 */
export function DevMetricsOverlay({ recorder }: { recorder: DevMetricsRecorder }) {
  const snapshot = useSyncExternalStore(recorder.subscribe, recorder.getSnapshot);
  const samples = {
    voiceStart: snapshot.voiceStart?.count ?? 0,
    finalTranscript: snapshot.finalTranscript?.count ?? 0,
  };
  return (
    <aside
      aria-label={t('dev.title')}
      className="fixed bottom-sm left-sm z-50 flex max-w-xs flex-col gap-xs rounded-card bg-card p-sm text-meta text-ink shadow-ambient"
    >
      <p className="font-semibold">{t('dev.title')}</p>
      <ul className="flex flex-col gap-xs">
        {checkTargets(snapshot).map((result) => (
          <li key={result.metric} className="flex flex-col">
            <span>{t(LABEL_KEY[result.metric])}</span>
            <span className="flex flex-wrap gap-sm">
              <span className="font-semibold">{valueText(result)}</span>
              <span>{targetText(result)}</span>
              <span className="font-semibold">{metText(result)}</span>
            </span>
            {(result.metric === 'voiceStart' || result.metric === 'finalTranscript') && (
              <span className="text-ink-secondary">{t('dev.samples', { count: samples[result.metric] })}</span>
            )}
          </li>
        ))}
      </ul>
      <p className="text-ink-secondary">{t('dev.note')}</p>
    </aside>
  );
}
