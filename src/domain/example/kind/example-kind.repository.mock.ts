import { type Mocked, vi } from 'vitest'

import type { IExampleKindRepository } from './example-kind.repository.interface.js'

export type ExampleKindRepositoryMock = Mocked<IExampleKindRepository>

export function mockExampleKindRepository(): ExampleKindRepositoryMock {
  return {
    getAll: vi.fn(),
    get: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  }
}
