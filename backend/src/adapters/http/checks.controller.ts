import {
  BadRequestException,
  Body,
  Controller,
  HttpStatus,
  Inject,
  Logger,
  Post,
  Res,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import { CHECK_REPOSITORY, type CheckRepository } from '../../application/ports/check-repository.port';
import { ingestCheck, type IngestResult } from '../../application/use-cases/ingest-check';
import { withDatabase } from './database-errors';
import { SyncCodeGuard } from './code.guard';

const INVALID_CHECK_ERROR = 'invalid_check';

/** Accepts one daily check from the tablet. Protected by the shared sync code (`X-Sync-Code`). */
@Controller('checks')
@UseGuards(SyncCodeGuard)
export class ChecksController {
  private readonly logger = new Logger(ChecksController.name);

  constructor(@Inject(CHECK_REPOSITORY) private readonly repo: CheckRepository) {}

  @Post()
  async ingest(@Body() body: unknown, @Res({ passthrough: true }) res: Response): Promise<IngestResponse> {
    const result: IngestResult = await withDatabase(() => ingestCheck(this.repo, body), this.logger);

    if (result.status === 'invalid') {
      throw new BadRequestException({ error: INVALID_CHECK_ERROR, issues: result.issues });
    }
    if (result.status === 'created') {
      res.status(HttpStatus.CREATED);
      return { status: 'created', id: result.id };
    }
    res.status(HttpStatus.OK);
    return { status: 'duplicate', id: result.id };
  }
}

/** Response body of `POST /api/v1/checks` on success. */
type IngestResponse = { status: 'created' | 'duplicate'; id: string };
