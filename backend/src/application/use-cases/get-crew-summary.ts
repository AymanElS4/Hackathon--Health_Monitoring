import type { CheckRepository, CheckView } from '../ports/check-repository.port';
import { historyWindow } from '../../domain/history-window';

/** One crew member's latest check and the calendar-window history, newest first. */
export type CrewSummary = {
  crewId: string;
  /** `YYYY-MM-DD`, UTC. */
  missionStartDate: string;
  latest: CheckView;
  /** Checks in the history window (includes the latest check), newest first. */
  history: CheckView[];
};

/**
 * Summary of one crew member for the surgeon detail view, or `null` when the crew member is unknown
 * or has no checks.
 */
export async function getCrewSummary(repo: CheckRepository, crewId: string): Promise<CrewSummary | null> {
  const crew = await repo.getCrew(crewId);
  const latest = await repo.getLatestCheck(crewId);
  if (!crew || !latest) {
    return null;
  }

  const { from, to } = historyWindow(latest.completedAt);
  const history = await repo.listChecks(crewId, from, to);
  return { crewId: crew.crewId, missionStartDate: crew.missionStartDate, latest, history };
}
