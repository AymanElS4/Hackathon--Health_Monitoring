import { describe, it, expect, vi } from 'vitest';
import type { ConnectivityPort } from '../../src/application/ports';
import { NavigatorConnectivity } from '../../src/adapters/navigator-connectivity/NavigatorConnectivity';
import { FakeConnectivity } from '../../src/adapters/fakes/FakeConnectivity';

// Shared contract: the real adapter and the fake must behave the same way (Liskov).
interface ConnectivityHarness {
  connectivity: ConnectivityPort;
  goOffline(): void;
  goOnline(): void;
}

function navigatorHarness(): ConnectivityHarness {
  const fakeNavigator = { onLine: true };
  const target = new EventTarget();
  const connectivity = new NavigatorConnectivity({
    navigator: fakeNavigator,
    target: target as unknown as Pick<Window, 'addEventListener' | 'removeEventListener'>,
  });
  const setOnline = (value: boolean): void => {
    fakeNavigator.onLine = value;
    target.dispatchEvent(new Event(value ? 'online' : 'offline'));
  };
  return {
    connectivity,
    goOffline: () => setOnline(false),
    goOnline: () => setOnline(true),
  };
}

function fakeHarness(): ConnectivityHarness {
  const connectivity = new FakeConnectivity();
  return {
    connectivity,
    goOffline: () => connectivity.setOnline(false),
    goOnline: () => connectivity.setOnline(true),
  };
}

const factories: Array<[string, () => ConnectivityHarness]> = [
  ['NavigatorConnectivity', navigatorHarness],
  ['FakeConnectivity', fakeHarness],
];

describe.each(factories)('ConnectivityPort contract: %s', (_name, make) => {
  it('reports online initially', () => {
    expect(make().connectivity.isOnline()).toBe(true);
  });

  it('notifies false and reports offline when going offline', () => {
    const { connectivity, goOffline } = make();
    const cb = vi.fn();
    connectivity.subscribe(cb);

    goOffline();

    expect(cb).toHaveBeenCalledWith(false);
    expect(connectivity.isOnline()).toBe(false);
  });

  it('notifies true and reports online when going online again', () => {
    const { connectivity, goOffline, goOnline } = make();
    const cb = vi.fn();
    connectivity.subscribe(cb);
    goOffline();

    goOnline();

    expect(cb).toHaveBeenLastCalledWith(true);
    expect(connectivity.isOnline()).toBe(true);
  });

  it('stops notifying after unsubscribe', () => {
    const { connectivity, goOffline, goOnline } = make();
    const cb = vi.fn();
    const unsubscribe = connectivity.subscribe(cb);
    unsubscribe();

    goOffline();
    goOnline();

    expect(cb).not.toHaveBeenCalled();
  });
});
