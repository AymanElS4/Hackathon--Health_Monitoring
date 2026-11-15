/**
 * Startup seeding in App: the app renders when the container's seed resolves or rejects. The
 * timeout itself is the container's job (composition root, SEED_TIMEOUT_MS) and is tested there.
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';

const seedMock = vi.hoisted(() => ({ next: (): Promise<void> => Promise.resolve() }));

vi.mock('../../src/composition-root', () => ({
  createContainer: () => ({ seedHistoryIfEmpty: () => seedMock.next() }),
}));
vi.mock('../../src/ui/screens/Home', () => ({ Home: () => <p>HOME_MOCK</p> }));
vi.mock('../../src/ui/screens/CheckIn', () => ({ CheckIn: () => null }));
vi.mock('../../src/ui/screens/History', () => ({ History: () => null }));

import { App } from '../../src/App';

afterEach(() => {
  cleanup();
});

describe('App startup seeding', () => {
  it('renders the app when the seed resolves', async () => {
    seedMock.next = () => Promise.resolve();
    render(<App />);

    expect(await screen.findByText('HOME_MOCK')).toBeInTheDocument();
  });

  it('renders the app when the seed fails or times out (the container rejects)', async () => {
    seedMock.next = () => Promise.reject(new Error('timed out'));
    render(<App />);

    expect(await screen.findByText('HOME_MOCK')).toBeInTheDocument();
  });
});
