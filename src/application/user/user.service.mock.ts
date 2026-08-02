import { type Mocked, vi } from 'vitest'

import type { IUserService } from './user.service.interface.js'

export type UserServiceMock = Mocked<IUserService>

export function mockUserService(): UserServiceMock {
  return {
    assignTeam: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
