import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { Home } from './screens/Home';
import { CheckIn } from './screens/CheckIn';
import { History } from './screens/History';

/** App shell: React Router v5 routes for the three screens. */
export function App() {
  return (
    <BrowserRouter>
      <Switch>
        <Route exact path="/" component={Home} />
        <Route path="/checkin" component={CheckIn} />
        <Route path="/historial" component={History} />
      </Switch>
    </BrowserRouter>
  );
}
