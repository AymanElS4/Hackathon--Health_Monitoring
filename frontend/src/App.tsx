import { useState } from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { createContainer } from './composition-root';
import { AppServicesProvider } from './ui/AppServices';
import { Home } from './ui/screens/Home';
import { CheckIn } from './ui/screens/CheckIn';
import { History } from './ui/screens/History';
import { Agenda } from './ui/screens/Agenda';
import { AGENDA_PATH, CHECKIN_PATH, HISTORY_PATH, HOME_PATH } from './config/constants';

/** App shell: React Router v5 routes for the four screens. */
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
        </Switch>
      </BrowserRouter>
    </AppServicesProvider>
  );
}
