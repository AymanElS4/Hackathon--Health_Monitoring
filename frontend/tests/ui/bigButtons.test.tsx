/**
 * Tests for the big answer buttons (T060, CL1, RF12). Each option's value is run through the
 * real parser, so a button always sends text the check-in understands.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { BigButtons } from '../../src/ui/components/BigButtons';
import { parseUtterance } from '../../src/domain/parsing/parseUtterance';
import { t } from '../../src/config/messages.es';

afterEach(() => {
  cleanup();
});

const buttons = () => screen.getAllByRole('button');

describe('BigButtons', () => {
  it('ask_sleep shows 33 options from 0 to 16 hours in half-hour steps', () => {
    render(<BigButtons step="ask_sleep" onAnswer={vi.fn()} />);

    expect(buttons()).toHaveLength(33);
    expect(screen.getByRole('button', { name: t('checkin.hoursOption', { h: '0' }) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('checkin.hoursOption', { h: '7,5' }) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('checkin.hoursOption', { h: '16' }) })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '7,5 h' })).toBeInTheDocument();
  });

  it('ask_mood shows the five mood words', () => {
    render(<BigButtons step="ask_mood" onAnswer={vi.fn()} />);

    expect(buttons()).toHaveLength(5);
    for (let mood = 1; mood <= 5; mood += 1) {
      expect(screen.getByRole('button', { name: t(`checkin.moodOption.${mood}`) })).toBeInTheDocument();
    }
  });

  it.each(['confirm_sleep', 'confirm_mood'] as const)('%s shows sí and no', (step) => {
    render(<BigButtons step={step} onAnswer={vi.fn()} />);

    expect(buttons()).toHaveLength(2);
    expect(screen.getByRole('button', { name: t('checkin.yes') })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: t('checkin.no') })).toBeInTheDocument();
  });

  it('next_activity shows only sí (the next-activity grammar has no no)', () => {
    render(<BigButtons step="next_activity" onAnswer={vi.fn()} />);

    expect(buttons()).toHaveLength(1);
    expect(screen.getByRole('button', { name: t('checkin.yes') })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: t('checkin.no') })).not.toBeInTheDocument();
  });

  it('ask_symptoms shows the four symptoms and ninguno', () => {
    render(<BigButtons step="ask_symptoms" onAnswer={vi.fn()} />);

    expect(buttons()).toHaveLength(5);
    for (const name of ['Mareo', 'Desmayo', 'Dolor de pecho', 'Falta de aire', 'Ninguno']) {
      expect(screen.getByRole('button', { name })).toBeInTheDocument();
    }
  });

  it('shows nothing for a step that does not listen for an answer', () => {
    render(<BigButtons step="greeting" onAnswer={vi.fn()} />);

    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('every button is at least the touch target height', () => {
    render(<BigButtons step="ask_sleep" onAnswer={vi.fn()} />);

    for (const button of buttons()) {
      expect(button).toHaveClass('min-h-touch');
    }
  });

  it('tapping 7,5 h answers "7.5", which the parser reads as 7.5 hours', () => {
    const onAnswer = vi.fn();
    render(<BigButtons step="ask_sleep" onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole('button', { name: '7,5 h' }));

    expect(onAnswer).toHaveBeenCalledWith('7.5');
    expect(parseUtterance('sleep', '7.5')).toEqual({ kind: 'value', indicator: 'sleep_hours', value: 7.5 });
  });

  it('every sleep value parses back to its own hour count', () => {
    const onAnswer = vi.fn();
    render(<BigButtons step="ask_sleep" onAnswer={onAnswer} />);

    for (const button of buttons()) {
      fireEvent.click(button);
    }
    const sent = onAnswer.mock.calls.map(([text]) => text as string);
    expect(sent).toHaveLength(33);
    for (const text of sent) {
      expect(parseUtterance('sleep', text)).toMatchObject({ kind: 'value', indicator: 'sleep_hours' });
    }
    expect(sent[0]).toBe('0');
    expect(sent[sent.length - 1]).toBe('16');
  });

  it('tapping a mood sends its digit, which the parser reads as that mood', () => {
    const onAnswer = vi.fn();
    render(<BigButtons step="ask_mood" onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole('button', { name: t('checkin.moodOption.5') }));

    expect(onAnswer).toHaveBeenCalledWith('5');
    expect(parseUtterance('mood', '5')).toEqual({ kind: 'value', indicator: 'mood', value: 5 });
  });

  it('tapping sí sends a confirm intent', () => {
    const onAnswer = vi.fn();
    render(<BigButtons step="confirm_sleep" onAnswer={onAnswer} />);

    fireEvent.click(screen.getByRole('button', { name: t('checkin.yes') }));

    expect(onAnswer).toHaveBeenCalledWith(t('checkin.yes'));
    expect(parseUtterance('confirm', t('checkin.yes'))).toEqual({ kind: 'intent', intent: 'confirm' });
  });

  it('every symptom button sends a phrase the parser maps to its symptom', () => {
    const onAnswer = vi.fn();
    render(<BigButtons step="ask_symptoms" onAnswer={onAnswer} />);

    for (const button of buttons()) {
      fireEvent.click(button);
    }
    const sent = onAnswer.mock.calls.map(([text]) => text as string);
    expect(sent).toHaveLength(5);
    expect(parseUtterance('symptoms', sent[0])).toEqual({ kind: 'symptoms', symptoms: ['dizziness'] });
    expect(parseUtterance('symptoms', sent[2])).toEqual({ kind: 'symptoms', symptoms: ['chest_pain'] });
    expect(parseUtterance('symptoms', sent[4])).toEqual({ kind: 'symptoms', symptoms: ['none'] });
  });
});
