import { useEffect, useState } from 'react';
import { useLocale } from './ui/useLocale';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { createContainer } from './composition-root';
import { AppServicesProvider } from './ui/AppServices';
import { Home } from './ui/screens/Home';
import { CheckIn } from './ui/screens/CheckIn';
import { History } from './ui/screens/History';
import { Agenda } from './ui/screens/Agenda';
import { Guide } from './ui/screens/Guide';
import {
  AGENDA_PATH,
  CHECKIN_PATH,
  GUIDE_PATH,
  HEALTH_PATH,
  HISTORY_PATH,
  HOME_PATH,
  METRICS_PATH,
} from './config/constants';

/** App shell: React Router v5 routes for the screens. */
export function App() {
  const locale = useLocale();
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
      <BrowserRouter key={locale}>
        <Switch>
          <Route exact path={HOME_PATH} component={Home} />
          <Route exact path={AGENDA_PATH} component={Agenda} />
          <Route path={CHECKIN_PATH} component={CheckIn} />
          <Route path={HISTORY_PATH} component={History} />
          <Route path={HEALTH_PATH} component={History} />
          <Route path={METRICS_PATH} component={History} />
          <Route path={GUIDE_PATH} component={Guide} />
          <Route path="/guias" component={Guide} />
        </Switch>
      </BrowserRouter>
    </AppServicesProvider>
  );
}
