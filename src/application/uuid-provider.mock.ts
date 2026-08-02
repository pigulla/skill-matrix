import { type Mocked, vi } from 'vitest'

import { IUuidProvider } from './uuid-provider.interface.js'

export type UuidProviderMock<T extends string = string> = Mocked<IUuidProvider<T>>

export function mockUuidProvider<T extends string = string>(
  uuids: string[] = [],
): UuidProviderMock<T> {
  const ids = [...uuids]

  return {
    generate: vi.fn().mockImplementation(() => {
      const next = ids.shift()

      if (next === undefined) {
        throw new Error('No further UUIDs mocked')
      }

      return next as T
    }),
  }
}
