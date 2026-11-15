import { optionsFor, type AnswerStep } from './stepOptions';
import { Chip, type ChipSize } from './Chip';

export interface OptionChipsProps {
  step: AnswerStep;
  /** Receives the option's text exactly as a transcript would arrive (the same path as BigButtons). */
  onAnswer: (text: string) => void;
  size?: ChipSize;
}

/** Layout of the chips: a wrapping row for the quick replies, a grid for the large fallback. */
const LAYOUT: Record<ChipSize, string> = {
  quick: 'flex flex-wrap gap-sm',
  large: 'grid grid-cols-3 gap-sm',
};

/** The chips of one step's options. Renders nothing for a step without options. */
export function OptionChips({ step, onAnswer, size = 'quick' }: OptionChipsProps) {
  const options = optionsFor(step);
  if (options.length === 0) return null;
  return (
    <div className={LAYOUT[size]}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          figure={option.figure}
          icon={option.icon}
          size={size}
          onClick={() => onAnswer(option.value)}
        />
      ))}
    </div>
  );
}
