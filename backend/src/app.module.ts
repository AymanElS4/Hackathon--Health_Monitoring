import { DynamicModule, Module } from '@nestjs/common';
import { HealthController } from './adapters/http/health.controller';
import { PgDatabaseProbe } from './adapters/postgres/pg-database-probe';
import { createPool, PG_POOL, PoolShutdown } from './adapters/postgres/pool';
import { DATABASE_PROBE } from './application/ports/database-probe.port';
import { ENV, type Env } from './config/env';

/** Composition root: the only place where ports are bound to adapters. */
@Module({})
export class AppModule {
  static forRoot(env: Env): DynamicModule {
    return {
      module: AppModule,
      controllers: [HealthController],
      providers: [
        { provide: ENV, useValue: env },
        { provide: PG_POOL, useFactory: () => createPool(env.databaseUrl) },
        { provide: DATABASE_PROBE, useClass: PgDatabaseProbe },
        PoolShutdown,
      ],
    };
  }
}
