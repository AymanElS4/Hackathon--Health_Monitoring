import type { CheckRepository, OpenAlertView } from '../ports/check-repository.port';
import { orderAlerts } from '../../domain/crew-ordering';

/** Open alerts for the surgeon queue: `now` first, then oldest first. */
export async function listAlerts(repo: CheckRepository): Promise<OpenAlertView[]> {
  return orderAlerts(await repo.listOpenAlerts());
}
