import type { Dayjs } from 'dayjs'

export abstract class ITimeProvider {
  public abstract now(): Dayjs
  public abstract highResolutionTimestamp(): bigint
}
