import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Card } from '../../src/ui/components/Card';
import { SectionHeader } from '../../src/ui/components/SectionHeader';
import { Badge } from '../../src/ui/components/Badge';
import { Button } from '../../src/ui/components/Button';
import { StatCard } from '../../src/ui/components/StatCard';
import { messages } from '../../src/config/messages.es';

afterEach(() => {
  cleanup();
});

describe('Card', () => {
  it('renders its children inside an element with the card token classes', () => {
    render(
      <Card>
        <p>{messages['level.green']}</p>
      </Card>,
    );

    const child = screen.getByText(messages['level.green']);
    const container = child.closest('.bg-card');
    expect(container).not.toBeNull();
    expect(container).toHaveClass('bg-card', 'rounded-card', 'shadow-ambient');
  });
});

describe('SectionHeader', () => {
  it('renders the title and the subtitle when provided', () => {
    render(<SectionHeader title={messages['level.red']} subtitle={messages['team.criterion']} />);

    expect(screen.getByText(messages['level.red'])).toBeInTheDocument();
    expect(screen.getByText(messages['team.criterion'])).toBeInTheDocument();
  });

  it('does not render a subtitle element when subtitle is absent', () => {
    render(<SectionHeader title={messages['level.red']} />);

    expect(screen.getByText(messages['level.red'])).toBeInTheDocument();
    expect(screen.queryByText(messages['team.criterion'])).not.toBeInTheDocument();
  });
});

describe('Badge', () => {
  it('renders the green label with the green level classes and never a primary class', () => {
    render(<Badge level="green">{messages['level.green']}</Badge>);

    const badge = screen.getByText(messages['level.green']);
    expect(badge).toHaveClass('text-level-green', 'bg-level-green-bg');
    expect(badge.className).not.toMatch(/primary/);
  });

  it('renders the amber label with the amber level text class', () => {
    render(<Badge level="amber">{messages['level.amber']}</Badge>);

    const badge = screen.getByText(messages['level.amber']);
    expect(badge).toHaveClass('text-level-amber');
    expect(badge.className).not.toMatch(/primary/);
  });

  it('renders the red label with the red level text class', () => {
    render(<Badge level="red">{messages['level.red']}</Badge>);

    const badge = screen.getByText(messages['level.red']);
    expect(badge).toHaveClass('text-level-red');
    expect(badge.className).not.toMatch(/primary/);
  });

  it('renders the optional criterion mark from messages', () => {
    render(
      <Badge level="green" mark>
        {messages['level.green']}
      </Badge>,
    );

    expect(screen.getByText(messages['team.criterion.mark'])).toBeInTheDocument();
  });
});

describe('Button', () => {
  it('renders children with the touch min-height class (48 px token)', () => {
    render(<Button onClick={() => {}}>{messages['team.criterion']}</Button>);

    const button = screen.getByRole('button', { name: messages['team.criterion'] });
    expect(button).toHaveClass('min-h-touch');
  });

  it('calls onClick when clicked', () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>{messages['team.criterion']}</Button>);

    fireEvent.click(screen.getByRole('button', { name: messages['team.criterion'] }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not call onClick when disabled', () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        {messages['team.criterion']}
      </Button>,
    );

    const button = screen.getByRole('button', { name: messages['team.criterion'] });
    expect(button).toBeDisabled();

    fireEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('StatCard', () => {
  it('renders the label and the value', () => {
    render(<StatCard label={messages['level.green']} value="62 bpm" />);

    expect(screen.getByText(messages['level.green'])).toBeInTheDocument();
    expect(screen.getByText('62 bpm')).toBeInTheDocument();
  });

  it('renders the value with the neutral text-ink class and no level color class', () => {
    render(<StatCard label={messages['level.green']} value="62 bpm" />);

    const value = screen.getByText('62 bpm');
    expect(value).toHaveClass('text-ink');
    expect(value.className).not.toMatch(/text-level-/);
    expect(value.className).not.toMatch(/bg-level-/);
  });

  it('renders the optional children slot', () => {
    render(
      <StatCard label={messages['level.green']} value="62 bpm">
        <span>{messages['team.criterion']}</span>
      </StatCard>,
    );

    expect(screen.getByText(messages['team.criterion'])).toBeInTheDocument();
  });
});
