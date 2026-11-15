import {
  Controller,
  Get,
  Header,
  Inject,
  Logger,
  NotFoundException,
  Param,
  UseGuards,
} from '@nestjs/common';
import { CHECK_REPOSITORY, type CheckRepository, type CrewLatest } from '../../application/ports/check-repository.port';
import { getCrewSummary, type CrewSummary } from '../../application/use-cases/get-crew-summary';
import { listCrew } from '../../application/use-cases/list-crew';
import { CREW_ID_PATTERN } from '../../domain/sync-check';
import { withDatabase } from './database-errors';
import { SurgeonCodeGuard } from './code.guard';

const NOT_FOUND_ERROR = 'not_found';
const NO_STORE_CACHE_CONTROL = 'no-store';

/** Surgeon overview of the crew. Protected by the surgeon access code (`X-Access-Code`). */
@Controller('surgeon')
@UseGuards(SurgeonCodeGuard)
export class SurgeonController {
  private readonly logger = new Logger(SurgeonController.name);

  constructor(@Inject(CHECK_REPOSITORY) private readonly repo: CheckRepository) {}

  /** Latest check of every crew member, ordered alert, attention, ok. */
  @Get('crew')
  @Header('Cache-Control', NO_STORE_CACHE_CONTROL)
  async list(): Promise<CrewLatest[]> {
    return withDatabase(() => listCrew(this.repo), this.logger);
  }

  /** Latest check and 14-day history of one crew member. Malformed ids are answered without a query. */
  @Get('crew/:crewId')
  @Header('Cache-Control', NO_STORE_CACHE_CONTROL)
  async summary(@Param('crewId') crewId: string): Promise<CrewSummary> {
    if (!CREW_ID_PATTERN.test(crewId)) {
      throw new NotFoundException({ error: NOT_FOUND_ERROR });
    }
    const summary = await withDatabase(() => getCrewSummary(this.repo, crewId), this.logger);
    if (summary === null) {
      throw new NotFoundException({ error: NOT_FOUND_ERROR });
    }
    return summary;
  }
}
