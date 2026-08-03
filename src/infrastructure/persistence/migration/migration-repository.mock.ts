import { type Mocked, vi } from 'vitest'

import type { IMigrationRepository } from './migration-repository.interface.js'

export type MigrationRepositoryMock = Mocked<IMigrationRepository>

export function mockMigrationRepository(): MigrationRepositoryMock {
  return {
    getAll: vi.fn(),
  }
}
