import { type Mocked, vi } from 'vitest'

import type { ITeamService } from './team.service.interface.js'

export type TeamServiceMock = Mocked<ITeamService>

export function mockTeamService(): TeamServiceMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
