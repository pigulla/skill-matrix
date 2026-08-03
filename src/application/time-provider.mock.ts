import type { Dayjs } from 'dayjs'
import { type Mocked, vi } from 'vitest'

import type { ITimeProvider } from './time-provider.interface.js'

export type TimeProviderMock = Mocked<ITimeProvider>

export function mockTimeProvider(now?: Dayjs): TimeProviderMock {
  return {
    now: vi.fn().mockReturnValue(now),
    highResolutionTimestamp: vi
      .fn()
      .mockReturnValue(now === undefined ? undefined : BigInt(now.unix() * 10e6)),
  }
}
