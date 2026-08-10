import dayjs, { type Dayjs } from 'dayjs'
import z from 'zod'

export const dayjsSchema = z
  .custom<Dayjs>(value => dayjs.isDayjs(value), 'Expected a Dayjs instance')
  .refine(value => value.isValid(), 'Expected a valid Dayjs instance')
