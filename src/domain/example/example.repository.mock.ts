import { type Mocked, vi } from 'vitest'

import type { IExampleRepository } from './example.repository.interface.js'

export type ExampleRepositoryMock = Mocked<IExampleRepository>

export function mockExampleRepository(): ExampleRepositoryMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
