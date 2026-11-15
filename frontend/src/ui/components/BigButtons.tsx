import type { AnswerStep } from './chat/stepOptions';
import { OptionChips } from './chat/OptionChips';

export interface BigButtonsProps {
  step: AnswerStep;
  /** Receives the text the parser reads, exactly as a transcript would arrive. */
  onAnswer: (text: string) => void;
}

/**
 * Big fallback buttons that answer a step in place of the voice (CL1, RF12). Same chips as the
 * quick replies of the chat, in the large size (T080a). Steps without options render nothing.
 */
export function BigButtons({ step, onAnswer }: BigButtonsProps) {
  return <OptionChips step={step} onAnswer={onAnswer} size="large" />;
}
