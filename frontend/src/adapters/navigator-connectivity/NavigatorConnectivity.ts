import type { ConnectivityPort } from '../../application/ports';

/** Minimal navigator surface used for the connectivity check. */
export type ConnectivityNavigator = Pick<Navigator, 'onLine'>;

/** Minimal event target surface used to listen for online/offline events. */
export type ConnectivityTarget = Pick<Window, 'addEventListener' | 'removeEventListener'>;

export interface NavigatorConnectivityOptions {
  navigator?: ConnectivityNavigator;
  target?: ConnectivityTarget;
}

/** Real connectivity: `navigator.onLine` plus the `online`/`offline` window events. */
export class NavigatorConnectivity implements ConnectivityPort {
  private readonly navigator: ConnectivityNavigator;
  private readonly target: ConnectivityTarget;

  constructor(options: NavigatorConnectivityOptions = {}) {
    this.navigator = options.navigator ?? navigator;
    this.target = options.target ?? window;
  }

  isOnline(): boolean {
    return this.navigator.onLine;
  }

  subscribe(cb: (online: boolean) => void): () => void {
    const handleOnline = (): void => cb(true);
    const handleOffline = (): void => cb(false);
    this.target.addEventListener('online', handleOnline);
    this.target.addEventListener('offline', handleOffline);
    return () => {
      this.target.removeEventListener('online', handleOnline);
      this.target.removeEventListener('offline', handleOffline);
    };
  }
}
