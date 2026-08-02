import { type Mocked, vi } from 'vitest'

import type { IExampleService } from './example.service.interface.js'

export type ExampleServiceMock = Mocked<IExampleService>

export function mockExampleService(): ExampleServiceMock {
  return {
    create: vi.fn(),
    delete: vi.fn(),
    get: vi.fn(),
    getAll: vi.fn(),
    update: vi.fn(),
  }
}
