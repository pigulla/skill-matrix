import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { MissingMigrationsTableError } from '#/infrastructure/persistence/migration/error/missing-migrations-table.error.js'
import { MigrationRepository } from '#/infrastructure/persistence/migration/migration-repository.js'

import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('MigrationRepository', () => {
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let migrationRepository: MigrationRepository
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: MigrationRepository.name,
        providers: [MigrationRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    migrationRepository = app.get(MigrationRepository)
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('getAll', () => {
    it('should return the names of all applied migrations', async () => {
      const result = await migrationRepository.getAll()

      expect(result).not.toEqual([])
    })

    it('should throw MissingMigrationsTableError when the migrations table does not exist', async () => {
      await db.none('ALTER TABLE pgmigrations RENAME TO pgmigrations_renamed')

      await expect(migrationRepository.getAll()).rejects.toThrow(MissingMigrationsTableError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE pgmigrations RENAME COLUMN name TO name_renamed')

      await expect(migrationRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
