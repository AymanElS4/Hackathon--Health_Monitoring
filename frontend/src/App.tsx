import { useState } from 'react';
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
  const [services] = useState(() => createContainer());
  return (
    <AppServicesProvider services={services}>
      <BrowserRouter>
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
