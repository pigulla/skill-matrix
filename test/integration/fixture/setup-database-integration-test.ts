import { join } from 'node:path'

import type { ModuleMetadata } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Test, type TestingModuleBuilder } from '@nestjs/testing'
import { ClsPluginTransactional } from '@nestjs-cls/transactional'
import { TransactionalAdapterPgPromise } from '@nestjs-cls/transactional-adapter-pg-promise'
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { PostgreSqlContainer } from '@testcontainers/postgresql'
import { ClsModule } from 'nestjs-cls'
import { LoggerModule } from 'nestjs-pino'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import { runner } from 'node-pg-migrate'
import { txMode } from 'pg-promise'
import { expect } from 'vitest'

import { createDatabaseConfig, DATABASE_CONFIG } from '#/infrastructure/config/database.config.js'
import {
  DB_CONNECTION,
  IConnectionProvider,
} from '#/infrastructure/persistence/connection-provider.interface.js'
import { ConfigModule } from '#/module/config.module.js'
import { DatabaseModule } from '#/module/database.module.js'
import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

import pgPromiseConfig from '../../../.pgmigrate.json' with { type: 'json' }

import {
  ASSOCIATION_ASSERTION_HELPER,
  type AssociationHelper,
  createAssociationAssertionHelper,
} from './association-assertion-helper.js'
import {
  createEntityAssertionHelper,
  ENTITY_ASSERTION_HELPER,
  type EntityAssertionHelper,
} from './entity-assertion-helper.js'

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

  async function beforeAll(): Promise<void> {
    postgresContainer = await new PostgreSqlContainer('postgres:18-alpine')
      .withCopyFilesToContainer([
        {
          source: join(import.meta.dirname, 'fixture.sql'),
          target: '/fixture.sql',
        },
      ])
      .start()
  }

  async function afterAll(): Promise<void> {
    await postgresContainer?.stop()
  }

  async function beforeEach(): Promise<void> {
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
        PGDATABASE: postgresContainer.getDatabase(),
      },
    })
    expect(result.exitCode).toBe(0)
  }

  async function afterEach(): Promise<void> {
    await runner({
      migrationsTable,
      dir: migrationsDirectory,
      count: Number.POSITIVE_INFINITY,
      direction: 'down',
      ignorePattern: '\\..*',
      databaseUrl: postgresContainer.getConnectionUri(),
      log: () => {},
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
        {
          provide: ENTITY_ASSERTION_HELPER,
          inject: [IConnectionProvider],
          useFactory({ database }: IConnectionProvider): EntityAssertionHelper {
            return createEntityAssertionHelper(database)
          },
        },
        {
          provide: ASSOCIATION_ASSERTION_HELPER,
          inject: [IConnectionProvider],
          useFactory({ database }: IConnectionProvider): AssociationHelper {
            return createAssociationAssertionHelper(database)
          },
        },
      ],
      exports: [...(options?.exports ?? []), ENTITY_ASSERTION_HELPER],
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
            database: postgresContainer.getDatabase(),
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
