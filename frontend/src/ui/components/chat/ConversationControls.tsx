import { t } from '../../../config/messages.es';

export interface ConversationControlsProps {
  paused: boolean;
  onPause: () => void;
  onResume: () => void;
  onRepeat: () => void;
}

interface ControlProps {
  emoji: string;
  word: string;
  onClick: () => void;
}

/** Round 48 px button on the track token; the emoji is large, the word sits below it (13 px). */
function Control({ emoji, word, onClick }: ControlProps) {
  return (
    <div className="flex flex-col items-center gap-xs">
      <button
        type="button"
        aria-label={word}
        onClick={onClick}
        className="flex h-touch w-touch items-center justify-center rounded-full bg-track text-heading hover:bg-primary hover:text-card"
      >
        <span aria-hidden="true">{emoji}</span>
      </button>
      <span aria-hidden="true" className="text-meta font-semibold text-ink">
        {word}
      </span>
    </div>
  );
}

/**
 * Pausa and Repetir, top-right of the conversation. While paused, Pausa is replaced by Seguir. The
 * grey hint names the spoken control words (T080a).
 */
export function ConversationControls({ paused, onPause, onResume, onRepeat }: ConversationControlsProps) {
  return (
    <div className="flex flex-col items-end gap-xs">
      <div className="flex gap-md">
        {paused ? (
          <Control emoji={t('checkin.resume.icon')} word={t('checkin.resume')} onClick={onResume} />
        ) : (
          <Control emoji={t('checkin.pause.icon')} word={t('checkin.pause')} onClick={onPause} />
        )}
        <Control emoji={t('checkin.repeat.icon')} word={t('checkin.repeat')} onClick={onRepeat} />
      </div>
      <p className="text-meta text-ink-secondary">{t('checkin.controlsHint')}</p>
    </div>
  );
}
