import { Controller, Get, Header, HttpStatus, Inject, Res } from '@nestjs/common';
import type { Response } from 'express';
import { getHealth, type HealthReport } from '../../application/use-cases/get-health';
import { DATABASE_PROBE, type DatabaseProbe } from '../../application/ports/database-probe.port';

/** Liveness of the service and reachability of its database. Global prefix is applied in main.ts. */
@Controller('health')
export class HealthController {
  constructor(@Inject(DATABASE_PROBE) private readonly probe: DatabaseProbe) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async health(@Res({ passthrough: true }) res: Response): Promise<HealthReport> {
    const report = await getHealth(this.probe);
    res.status(report.database === 'up' ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);
    return report;
  }
}
