import type { CheckRepository, CrewLatest } from '../ports/check-repository.port';
import { orderCrew } from '../../domain/crew-ordering';

/**
 * Latest check of every crew member for the surgeon overview: `alert`, `attention`, `ok`, then most
 * recent first.
 */
export async function listCrew(repo: CheckRepository): Promise<CrewLatest[]> {
  return orderCrew(await repo.listCrewLatest());
}
