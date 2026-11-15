import { Mic } from 'lucide-react';
import { t } from '../../../config/messages.es';

export interface MicIndicatorProps {
  listening: boolean;
  speaking: boolean;
}

/**
 * Listening: a pulsing blue circle and "Te escucho…" (the pulse only with motion allowed). Speaking:
 * a grey circle and "Vita está hablando…". Nothing otherwise; the row keeps its height.
 */
export function MicIndicator({ listening, speaking }: MicIndicatorProps) {
  return (
    <div className="flex h-avatar items-center">
      {listening && (
        <p className="flex items-center gap-sm text-small font-semibold text-primary">
          <span aria-hidden="true" className="relative flex h-avatar w-avatar items-center justify-center">
            <span className="absolute inset-0 rounded-full bg-primary opacity-30 motion-safe:animate-sensor-pulse" />
            <span className="relative flex h-avatar w-avatar items-center justify-center rounded-full bg-primary text-card">
              <Mic className="h-lg w-lg" />
            </span>
          </span>
          <span role="status">{t('checkin.listening')}</span>
        </p>
      )}
      {!listening && speaking && (
        <p className="flex items-center gap-sm text-small font-semibold text-ink-secondary">
          <span aria-hidden="true" className="flex h-avatar w-avatar items-center justify-center rounded-full bg-baseline">
            <Mic className="h-lg w-lg" />
          </span>
          <span role="status">{t('checkin.speaking')}</span>
        </p>
      )}
    </div>
  );
}
