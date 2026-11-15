import { INestApplication, RequestMethod } from '@nestjs/common';
import { API_PREFIX } from '../../config/constants';
import { BodyParseFilter } from './body-parse.filter';
import { PAGE_ROUTE } from './page.controller';

/** Wildcard that covers every asset under the page route. */
const PAGE_ROUTE_WILDCARD = `${PAGE_ROUTE}/*path`;

/**
 * Application wiring shared by `main.ts` and every e2e harness, so tests exercise the same routing:
 * the API prefix applies to the API only; the surgeon page (`/cirujano`) is served without it.
 * CORS is configured in `main.ts` only.
 */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix(API_PREFIX, {
    exclude: [
      { path: PAGE_ROUTE, method: RequestMethod.ALL },
      { path: PAGE_ROUTE_WILDCARD, method: RequestMethod.ALL },
    ],
  });
  app.useGlobalFilters(new BodyParseFilter());
}
