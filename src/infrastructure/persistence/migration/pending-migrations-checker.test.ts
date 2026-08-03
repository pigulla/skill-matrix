import { beforeEach, describe, expect, it } from 'vitest'

import {
  type DefinedMigrationsProviderMock,
  type MigrationRepositoryMock,
  mockDefinedMigrationsProvider,
  mockMigrationRepository,
} from '#/mocks.js'

import { MigrationsPendingError } from './error/migrations-pending.error.js'
import { NoMigrationsFoundError } from './error/no-migrations-found.error.js'
import { asMigration } from './migration.js'
import { PendingMigrationsChecker } from './pending-migrations-checker.js'

describe('PendingMigrationsChecker', () => {
  const MIGRATION_A = asMigration('a')
  const MIGRATION_B = asMigration('b')

  let migrationRepository: MigrationRepositoryMock
  let definedMigrationsProvider: DefinedMigrationsProviderMock
  let checker: PendingMigrationsChecker

  beforeEach(() => {
    migrationRepository = mockMigrationRepository()
    definedMigrationsProvider = mockDefinedMigrationsProvider()

    checker = new PendingMigrationsChecker(migrationRepository, definedMigrationsProvider)
  })

  describe('assertNoPendingMigrations', () => {
    it('should not throw if defined and applied migrations match', async () => {
      definedMigrationsProvider.getAll.mockResolvedValue([MIGRATION_A, MIGRATION_B])
      migrationRepository.getAll.mockResolvedValue([MIGRATION_A, MIGRATION_B])

      await expect(checker.assertNoPendingMigrations()).resolves.toBeUndefined()
    })

    it('should throw if no migrations are defined', async () => {
      definedMigrationsProvider.getAll.mockResolvedValue([])
      migrationRepository.getAll.mockResolvedValue([])

      await expect(checker.assertNoPendingMigrations()).rejects.toThrow(NoMigrationsFoundError)
    })

    it('should throw MigrationsPendingError if fewer migrations are applied than defined', async () => {
      definedMigrationsProvider.getAll.mockResolvedValue([MIGRATION_A, MIGRATION_B])
      migrationRepository.getAll.mockResolvedValue([MIGRATION_A])

      await expect(checker.assertNoPendingMigrations()).rejects.toThrow(MigrationsPendingError)
    })

    it('should throw MigrationsPendingError if an applied migration is not defined', async () => {
      definedMigrationsProvider.getAll.mockResolvedValue([MIGRATION_A])
      migrationRepository.getAll.mockResolvedValue([MIGRATION_B])

      await expect(checker.assertNoPendingMigrations()).rejects.toThrow(MigrationsPendingError)
    })

    it('should include the defined and applied migrations on the error', async () => {
      const defined = [MIGRATION_A]
      const applied = [MIGRATION_B]

      definedMigrationsProvider.getAll.mockResolvedValue(defined)
      migrationRepository.getAll.mockResolvedValue(applied)

      await expect(checker.assertNoPendingMigrations()).rejects.toMatchObject({
        defined: new Set(defined),
        applied: new Set(applied),
      })
    })
  })
})
