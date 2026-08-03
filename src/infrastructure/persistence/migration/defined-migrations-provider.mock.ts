import { type Mocked, vi } from 'vitest'

import type { IDefinedMigrationsProvider } from './defined-migrations-provider.interface.js'

export type DefinedMigrationsProviderMock = Mocked<IDefinedMigrationsProvider>

export function mockDefinedMigrationsProvider(): DefinedMigrationsProviderMock {
  return {
    getAll: vi.fn(),
  }
}
