import type { MouseEvent, ReactNode } from 'react';

export interface ButtonProps {
  children: ReactNode;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  /** Defaults to `button` so it never submits a surrounding form by accident. */
  type?: 'button' | 'submit' | 'reset';
  /** `pill` is the rounded primary action (Home "Empezar"); `card` keeps the card corner. */
  shape?: 'card' | 'pill';
}

/** Classes per shape: the card corner, or the full pill with the primary glow. */
const SHAPE_CLASSES: Record<NonNullable<ButtonProps['shape']>, string> = {
  card: 'rounded-card shadow-ambient',
  pill: 'rounded-full shadow-primary',
};

/** Primary action button with the touch-target minimum height. */
export function Button({ children, onClick, disabled = false, type = 'button', shape = 'card' }: ButtonProps) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`min-h-touch bg-primary px-lg text-small font-semibold text-card hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50 ${SHAPE_CLASSES[shape]}`}
    >
      {children}
    </button>
  );
}
