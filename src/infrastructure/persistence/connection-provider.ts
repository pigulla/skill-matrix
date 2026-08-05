import {
  Inject,
  Injectable,
  Logger,
  type OnApplicationShutdown,
  type OnModuleInit,
} from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import pgPromise, { type IEventContext, type IHelpers } from 'pg-promise'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'

import { DATABASE_CONFIG, type DatabaseConfig } from '../config/database.config.js'

import { IConnectionProvider } from './connection-provider.interface.js'

// PostgreSQL 18 is the first version where an `ON DELETE RESTRICT` foreign key reports its own
// SQLSTATE (23001, restrict_violation) instead of reusing `ON DELETE NO ACTION`'s 23503
// (foreign_key_violation). `isRestrictViolation` (see infrastructure/persistence/error/) relies on
// that distinction to translate RESTRICT violations into the correct domain error, so older servers
// would silently misclassify those violations as unexpected persistence errors.
const MINIMUM_POSTGRES_MAJOR_VERSION = 18

@Injectable()
export class ConnectionProvider
  implements IConnectionProvider, OnApplicationShutdown, OnModuleInit
{
  public readonly database: Database
  public readonly helpers: IHelpers

  private readonly config: DatabaseConfig
  private readonly logger: Logger

  public constructor(@Inject(DATABASE_CONFIG) config: DatabaseConfig) {
    this.config = config
    this.logger = new Logger(ConnectionProvider.name)

    const pgp = pgPromise({
      query: event => this.onQuery(event),
      noWarnings: config.disableWarnings,
    })
    pgp.pg.types.setTypeParser(1114 /* TIMESTAMP */, value => dayjs(value))
    pgp.pg.types.setTypeParser(1184 /* TIMESTAMPTZ */, value => dayjs(value))

    this.helpers = pgp.helpers
    this.database = pgp({
      application_name: config.connection.name,
      host: config.connection.host,
      database: config.connection.database,
      port: config.connection.port,
      user: config.connection.username,
      password: config.connection.password,
      ssl: config.connection.ssl,
    })
  }

  public async onModuleInit(): Promise<void> {
    await this.assertSupportedPostgresVersion()
  }

  private async assertSupportedPostgresVersion(): Promise<void> {
    let row: { version: string }

    try {
      row = await this.database.one<{ version: string }>(
        `SELECT current_setting('server_version_num') AS "version"`,
      )
    } catch (error) {
      throw new UnexpectedPersistenceError(error as Error)
    }

    const majorVersion = Math.floor(Number(row.version) / 10000)

    if (majorVersion < MINIMUM_POSTGRES_MAJOR_VERSION) {
      throw new UnexpectedPersistenceError(
        new Error(
          `Connected to PostgreSQL ${majorVersion} (server_version_num=${row.version}), but version ${MINIMUM_POSTGRES_MAJOR_VERSION} or newer is required.`,
        ),
      )
    }
  }

  private onQuery(event: IEventContext): void {
    if (!this.config.logQueries) {
      return
    }

    this.logger.verbose(
      {
        query: event.query as string,
        params: (event.params as string[] | undefined) ?? [],
      },
      'Query',
    )
  }

  public async onApplicationShutdown(_signal?: string): Promise<void> {
    this.logger.verbose('Closing connection')
    await this.database.$pool.end()
    this.logger.log('Connection closed')
  }
}
