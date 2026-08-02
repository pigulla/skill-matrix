import { hrtime } from 'node:process'

import type { Dayjs } from 'dayjs'
import dayjs from 'dayjs'

import { ITimeProvider } from '#/application/time-provider.interface.js'

export class TimeProvider implements ITimeProvider {
  public now(): Dayjs {
    return dayjs()
  }

  public highResolutionTimestamp(): bigint {
    return hrtime.bigint()
  }
}
