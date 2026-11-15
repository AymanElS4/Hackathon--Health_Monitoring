import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Inject,
  Logger,
  NotFoundException,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  CHECK_REPOSITORY,
  type AlertDecision,
  type CheckRepository,
  type CrewLatest,
  type OpenAlertView,
} from '../../application/ports/check-repository.port';
import { CLOCK, type Clock } from '../../application/ports/clock.port';
import { decideAlert } from '../../application/use-cases/decide-alert';
import { getCrewSummary, type CrewSummary } from '../../application/use-cases/get-crew-summary';
import { listAlerts } from '../../application/use-cases/list-alerts';
import { listCrew } from '../../application/use-cases/list-crew';
import { CREW_ID_PATTERN } from '../../domain/sync-check';
import { withDatabase } from './database-errors';
import { SurgeonCodeGuard } from './code.guard';

const NOT_FOUND_ERROR = 'not_found';
const INVALID_DECISION_ERROR = 'invalid_decision';
const ALREADY_DECIDED_ERROR = 'already_decided';
const NO_STORE_CACHE_CONTROL = 'no-store';

/** Response body of a recorded alert decision. */
type DecisionResponse = {
  id: string;
  status: 'decided';
  decision: AlertDecision | null;
  decidedAt: string | null;
};

/** Surgeon overview of the crew and the alert queue. Protected by the surgeon access code (`X-Access-Code`). */
@Controller('surgeon')
@UseGuards(SurgeonCodeGuard)
export class SurgeonController {
  private readonly logger = new Logger(SurgeonController.name);

  constructor(
    @Inject(CHECK_REPOSITORY) private readonly repo: CheckRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

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

  /** Open alerts of the crew: `now` first, then oldest first. */
  @Get('alerts')
  @Header('Cache-Control', NO_STORE_CACHE_CONTROL)
  async alerts(): Promise<OpenAlertView[]> {
    return withDatabase(() => listAlerts(this.repo), this.logger);
  }

  /** Records the surgeon's decision on an open alert. The body is `{ decision }`. */
  @Post('alerts/:id/decision')
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', NO_STORE_CACHE_CONTROL)
  async decide(@Param('id') id: string, @Body() body: unknown): Promise<DecisionResponse> {
    const decision = typeof body === 'object' && body !== null ? (body as { decision?: unknown }).decision : undefined;
    const result = await withDatabase(() => decideAlert(this.repo, this.clock, id, decision), this.logger);

    switch (result.status) {
      case 'decided':
        return {
          id: result.alert.id,
          status: 'decided',
          decision: result.alert.decision,
          decidedAt: result.alert.decidedAt,
        };
      case 'invalid_decision':
        throw new BadRequestException({ error: INVALID_DECISION_ERROR });
      case 'not_found':
        throw new NotFoundException({ error: NOT_FOUND_ERROR });
      case 'already_decided':
        throw new ConflictException({ error: ALREADY_DECIDED_ERROR });
    }
  }
}
