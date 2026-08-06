import { type Mocked, vi } from 'vitest'

import type { IExampleKindService } from './example-kind.service.interface.js'

export type ExampleKindServiceMock = Mocked<IExampleKindService>

export function mockExampleKindService(): ExampleKindServiceMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
