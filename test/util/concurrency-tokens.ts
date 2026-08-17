import dayjs from 'dayjs'

import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'

// Well-formed but guaranteed not to match any fixture row's `last_updated`.
export const STALE_CONCURRENCY_TOKEN = toConcurrencyToken(dayjs(0))
