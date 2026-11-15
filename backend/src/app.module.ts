import { DynamicModule, Module } from '@nestjs/common';
import { AttemptLimiter } from './adapters/http/attempt-limiter';
import { SurgeonCodeGuard, SyncCodeGuard } from './adapters/http/code.guard';
import { ChecksController } from './adapters/http/checks.controller';
import { HealthController } from './adapters/http/health.controller';
import { PageController } from './adapters/http/page.controller';
import { SurgeonController } from './adapters/http/surgeon.controller';
import { PgCheckRepository } from './adapters/postgres/pg-check-repository';
import { PgDatabaseProbe } from './adapters/postgres/pg-database-probe';
import { createPool, PG_POOL, PoolShutdown } from './adapters/postgres/pool';
import { SystemClock } from './adapters/system/system-clock';
import { CHECK_REPOSITORY } from './application/ports/check-repository.port';
import { CLOCK } from './application/ports/clock.port';
import { DATABASE_PROBE } from './application/ports/database-probe.port';
import { ENV, type Env } from './config/env';

/** Composition root: the only place where ports are bound to adapters. */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController, ChecksController, SurgeonController, PageController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: PG_POOL, useFactory: () => createPool(env.databaseUrl) },
        { provide: DATABASE_PROBE, useClass: PgDatabaseProbe },
        { provide: CHECK_REPOSITORY, useClass: PgCheckRepository },
        { provide: CLOCK, useClass: SystemClock },
        AttemptLimiter,
        SyncCodeGuard,
        SurgeonCodeGuard,
        PoolShutdown,
      ],
    };
  }
}
