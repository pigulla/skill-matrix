import { type Mocked, vi } from 'vitest'

import type { IExampleRepository } from './example.repository.interface.js'

export type ExampleRepositoryMock = Mocked<IExampleRepository>

export function mockExampleRepository(): ExampleRepositoryMock {
  return {
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
