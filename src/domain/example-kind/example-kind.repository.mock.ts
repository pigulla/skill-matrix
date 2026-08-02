import { type Mocked, vi } from 'vitest'

import type { IExampleKindRepository } from './example-kind.repository.interface.js'

export type ExampleKindRepositoryMock = Mocked<IExampleKindRepository>

export function mockExampleKindRepository(): ExampleKindRepositoryMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
  }
}
