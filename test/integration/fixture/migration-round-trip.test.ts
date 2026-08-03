import { join } from 'node:path'

import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql'
import { runner } from 'node-pg-migrate'
import pgPromise from 'pg-promise'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import pgPromiseConfig from '../../../.pgmigrate.json' with { type: 'json' }

describe('Migrations', () => {
  const rootDirectory = join(import.meta.dirname, '..', '..', '..')
  const migrationsTable = pgPromiseConfig['migrations-table']
  const migrationsDirectory = join(rootDirectory, pgPromiseConfig['migrations-dir'])

  let postgresContainer: StartedPostgreSqlContainer

  beforeAll(async () => {
    postgresContainer = await new PostgreSqlContainer('postgres:18-alpine').start()
  })
  afterAll(() => postgresContainer?.stop())

  it('applies all up migrations and then all down migrations without leaving tables behind', async () => {
    await runner({
      migrationsTable,
      dir: migrationsDirectory,
      count: Number.POSITIVE_INFINITY,
      direction: 'up',
      ignorePattern: '\\..*',
      databaseUrl: postgresContainer.getConnectionUri(),
      log: () => {},
    })

    await runner({
      migrationsTable,
      dir: migrationsDirectory,
      count: Number.POSITIVE_INFINITY,
      direction: 'down',
      ignorePattern: '\\..*',
      databaseUrl: postgresContainer.getConnectionUri(),
      log: () => {},
    })

    const pgp = pgPromise({ noWarnings: true })
    const db = pgp(postgresContainer.getConnectionUri())

    try {
      await expect(
        db.manyOrNone(
          "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name != $(migrationsTable)",
          { migrationsTable },
        ),
      ).resolves.toEqual([])
    } finally {
      await db.$pool.end()
    }
  })
})
