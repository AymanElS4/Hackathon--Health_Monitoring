import { useState } from 'react';
import { BrowserRouter, Route, Switch } from 'react-router-dom';
import { createContainer } from './composition-root';
import { Home } from './ui/screens/Home';
import { CheckIn } from './ui/screens/CheckIn';
import { History } from './ui/screens/History';

export function App() {
  const [container, setContainer] = useState(() => createContainer());

  return (
    <BrowserRouter>
      <Switch>
        <Route
          exact
          path="/"
          render={() => (
            <Home
              scenarioId={container.scenario.id}
              repository={container.repository}
              onScenarioChange={(scenarioId) =>
                setContainer(createContainer({ scenarioId }))
              }
            />
          )}
        />
        <Route path="/checkin" component={CheckIn} />
        <Route
          path="/historial"
          render={() => <History repository={container.repository} />}
        />
      </Switch>
    </BrowserRouter>
  );
}
