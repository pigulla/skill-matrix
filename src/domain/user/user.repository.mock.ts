import { type Mocked, vi } from 'vitest'

import type { IUserRepository } from './user.repository.interface.js'

export type UserRepositoryMock = Mocked<IUserRepository>

export function mockUserRepository(): UserRepositoryMock {
  return {
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
