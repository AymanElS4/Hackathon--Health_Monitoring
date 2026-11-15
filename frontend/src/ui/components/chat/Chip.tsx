/** Size of a chip: `quick` under the last Vita message, `large` for the fallback buttons (CL1). */
export type ChipSize = 'quick' | 'large';

export interface ChipProps {
  /** Accessible name: the word from messages.es.ts. */
  label: string;
  /** Large figure above the word, e.g. the mood digit. */
  figure?: string;
  /** Decorative emoji before the word. */
  icon?: string;
  size?: ChipSize;
  onClick: () => void;
}

const BASE =
  'flex min-h-touch min-w-touch flex-col items-center justify-center gap-xs rounded-card bg-track px-lg text-small font-semibold text-ink shadow-ambient hover:bg-primary-hover hover:text-card';
const SIZE: Record<ChipSize, string> = {
  quick: 'py-sm',
  large: 'py-md text-body',
};

/** One answer chip. Taps send the same text the voice would (see `OptionChips`). */
export function Chip({ label, figure, icon, size = 'quick', onClick }: ChipProps) {
  return (
    <button type="button" aria-label={label} onClick={onClick} className={`${BASE} ${SIZE[size]}`}>
      {figure !== undefined && (
        <span aria-hidden="true" className="text-heading font-bold">
          {figure}
        </span>
      )}
      <span aria-hidden="true" className="flex items-center gap-sm">
        {icon !== undefined && <span>{icon}</span>}
        <span>{label}</span>
      </span>
    </button>
  );
}
