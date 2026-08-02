import { type Mocked, vi } from 'vitest'

import type { IUserRepository } from './user.repository.interface.js'

export type UserRepositoryMock = Mocked<IUserRepository>

export function mockUserRepository(): UserRepositoryMock {
  return {
    assignTeam: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
