import { useEffect, useState } from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { createContainer } from './composition-root';
import { AppServicesProvider } from './ui/AppServices';
import { Home } from './ui/screens/Home';
import { CheckIn } from './ui/screens/CheckIn';
import { History } from './ui/screens/History';
import { CHECKIN_PATH, HISTORY_PATH, HOME_PATH } from './config/constants';

/** App shell: React Router v5 routes for the three screens. */
export function App() {
  const [services] = useState(() => createContainer());
  // Screens read the store on mount, so the simulated history is written before they render. The
  // container bounds the wait (SEED_TIMEOUT_MS), so a failed or slow seed still lets the app render.
  const [seeded, setSeeded] = useState(false);

  useEffect(() => {
    let active = true;
    const finish = () => {
      if (active) setSeeded(true);
    };
    services.seedHistoryIfEmpty().then(finish, finish);
    return () => {
      active = false;
    };
  }, [services]);

  if (!seeded) return null;
  return (
    <AppServicesProvider services={services}>
      <BrowserRouter>
        <Switch>
          <Route exact path={HOME_PATH} component={Home} />
          <Route path={CHECKIN_PATH} component={CheckIn} />
          <Route path={HISTORY_PATH} component={History} />
        </Switch>
      </BrowserRouter>
    </AppServicesProvider>
  );
}
