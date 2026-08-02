import { type Mocked, vi } from 'vitest'

import type { ITeamRepository } from './team.repository.interface.js'

export type TeamRepositoryMock = Mocked<ITeamRepository>

export function mockTeamRepository(): TeamRepositoryMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
