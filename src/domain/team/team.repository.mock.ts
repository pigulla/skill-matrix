import { type Mocked, vi } from 'vitest'

import type { ITeamRepository } from './team.repository.interface.js'

export type TeamRepositoryMock = Mocked<ITeamRepository>

export function mockTeamRepository(): TeamRepositoryMock {
  return {
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
