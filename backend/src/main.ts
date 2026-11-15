import 'reflect-metadata';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { Pool } from 'pg';
import { AppModule } from './app.module';
import { loadEnv, type Env } from './config/env';
import { MIGRATIONS_DIR, STARTUP_DB_ATTEMPTS, STARTUP_DB_DELAY_MS } from './config/constants';
import { configureApp } from './adapters/http/configure-app';
import { PG_POOL } from './adapters/postgres/pool';
import { runMigrations, waitForDatabase } from './adapters/postgres/migrator';

const BOOTSTRAP_CONTEXT = 'Bootstrap';
const MIGRATIONS_CONTEXT = 'Migrations';
const LISTEN_HOST = '0.0.0.0';
const EXIT_FAILURE = 1;

async function bootstrap(): Promise<void> {
  let env: Env;
  try {
    env = loadEnv(process.env);
  } catch (error) {
    console.error((error as Error).message);
    process.exit(EXIT_FAILURE);
  }

  const app = await NestFactory.create(AppModule.forRoot(env), {
    logger: ['log', 'warn', 'error'],
    abortOnError: false,
  });
  configureApp(app);
  app.enableCors({
    origin: env.corsOrigins,
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type', 'X-Sync-Code'],
  });
  app.enableShutdownHooks();

  const pool = app.get<Pool>(PG_POOL);
  await waitForDatabase(pool, STARTUP_DB_ATTEMPTS, STARTUP_DB_DELAY_MS);
  await runMigrations(pool, MIGRATIONS_DIR, (message) => Logger.log(message, MIGRATIONS_CONTEXT));

  await app.listen(env.port, LISTEN_HOST);
  Logger.log(`Listening on ${env.port}`, BOOTSTRAP_CONTEXT);
}

bootstrap().catch((error) => {
  console.error(error);
  process.exit(EXIT_FAILURE);
});
