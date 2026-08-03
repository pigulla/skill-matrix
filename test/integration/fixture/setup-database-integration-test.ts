import { join } from 'node:path'

import type { ModuleMetadata } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { ClsModule } from 'nestjs-cls'
import { LoggerModule } from 'nestjs-pino'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import { runner } from 'node-pg-migrate'
import pgPromise, { txMode } from 'pg-promise'
import { expect } from 'vitest'

import { createDatabaseConfig, DATABASE_CONFIG } from '#/infrastructure/config/database.config.js'
import { DB_CONNECTION } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ConfigModule } from '#/module/config.module.js'
import { DatabaseModule } from '#/module/database.module.js'
import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

import pgPromiseConfig from '../../../.pgmigrate.json' with { type: 'json' }

// The container's own default database ("test") is migrated and seeded exactly
// once in beforeAll, then flipped to a Postgres template database. Every test
// clones it with `CREATE DATABASE ... TEMPLATE`, which copies files on disk
// instead of replaying SQL — see
// https://gajus.com/blog/setting-up-postgre-sql-for-running-integration-tests#what-worked

const MAINTENANCE_DATABASE = 'postgres'

export function setupDatabaseIntegrationTest(): {
  beforeAll: () => Promise<void>
  beforeEach: () => Promise<void>
  afterEach: () => Promise<void>
  afterAll: () => Promise<void>
  createModule: (options?: ModuleMetadata & { testName?: string }) => TestingModuleBuilder
} {
  const rootDirectory = join(import.meta.dirname, '..', '..', '..')
  const migrationsTable = pgPromiseConfig['migrations-table']
  const migrationsDirectory = join(rootDirectory, pgPromiseConfig['migrations-dir'])

  let postgresContainer: StartedPostgreSqlContainer
  let templateDatabase: string
  let adminDb: Database
  let testDatabaseCounter = 0
  let currentTestDatabase: string

  async function beforeAll(): Promise<void> {
    postgresContainer = await new PostgreSqlContainer('postgres:18-alpine')
      .withCopyFilesToContainer([
        {
          source: join(import.meta.dirname, 'fixture.sql'),
          target: '/fixture.sql',
        },
      ])
      .start()

    templateDatabase = postgresContainer.getDatabase()

    await runner({
      migrationsTable,
      dir: migrationsDirectory,
      count: Number.POSITIVE_INFINITY,
      direction: 'up',
      ignorePattern: '\\..*',
      databaseUrl: postgresContainer.getConnectionUri(),
      log: () => {},
    })

    const result = await postgresContainer.exec('psql --file=/fixture.sql', {
      env: {
        PGUSER: postgresContainer.getUsername(),
        PGPASSWORD: postgresContainer.getPassword(),
        PGDATABASE: templateDatabase,
      },
    })
    expect(result.exitCode).toBe(0)

    const pgp = pgPromise({ noWarnings: true })
    adminDb = pgp({
      host: postgresContainer.getHost(),
      port: postgresContainer.getPort(),
      database: MAINTENANCE_DATABASE,
      user: postgresContainer.getUsername(),
      password: postgresContainer.getPassword(),
      ssl: false,
    })

    await adminDb.none('ALTER DATABASE $(templateDatabase:name) WITH IS_TEMPLATE true', {
      templateDatabase,
    })
  }

  async function afterAll(): Promise<void> {
    await adminDb?.$pool.end()
    await postgresContainer?.stop()
  }

  async function beforeEach(): Promise<void> {
    testDatabaseCounter += 1
    currentTestDatabase = `test_${testDatabaseCounter}`

    await adminDb.none('CREATE DATABASE $(testDatabase:name) TEMPLATE $(templateDatabase:name)', {
      testDatabase: currentTestDatabase,
      templateDatabase,
    })
  }

  async function afterEach(): Promise<void> {
    await adminDb.none('DROP DATABASE IF EXISTS $(testDatabase:name)', {
      testDatabase: currentTestDatabase,
    })
  }

  function createModule(options?: ModuleMetadata & { testName?: string }): TestingModuleBuilder {
    return Test.createTestingModule({
      imports: [
        ConfigModule,
        DatabaseModule,
        LoggerModule.forRoot({
          pinoHttp: {
            enabled: false,
          },
        }),
        ClsModule.forRoot({
          plugins: [
            new ClsPluginTransactional({
              imports: [DatabaseModule],
              adapter: new TransactionalAdapterPgPromise({
                dbInstanceToken: DB_CONNECTION,
                defaultTxOptions: {
                  mode: new txMode.TransactionMode({ tiLevel: txMode.isolationLevel.serializable }),
                },
              }),
            }),
          ],
        }),
        ...(options?.imports ?? []),
      ],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        ...(options?.providers ?? []),
      ],
      exports: options?.exports ?? [],
    })
      .overrideProvider(DATABASE_CONFIG)
      .useValue(
        createDatabaseConfig({
          connection: {
            // biome-ignore lint/style/noProcessEnv: no other way to get this value
            name: `${options?.testName ?? 'test'}::${process.env.VITEST_WORKER_ID}`,
            host: postgresContainer.getHost(),
            port: postgresContainer.getPort(),
            ssl: false,
            database: currentTestDatabase,
            username: postgresContainer.getUsername(),
            password: postgresContainer.getPassword(),
          },
          logQueries: false,
          disableWarnings: true,
        }),
      )
  }

  return { createModule, beforeAll, beforeEach, afterEach, afterAll }
}
