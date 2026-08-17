import { createHash } from 'node:crypto'

import type { Dayjs } from 'dayjs'

import { asConcurrencyToken, type ConcurrencyToken } from '#/domain/concurrency-token.js'

// Must stay in sync with the concurrency_token() Postgres function in
// migrations/20260728160000000_skills_and_examples.sql — see
// test/integration/persistence/concurrency-token.parity.test.ts, which guards the agreement.
export function toConcurrencyToken(lastUpdated: Dayjs): ConcurrencyToken {
  return asConcurrencyToken(createHash('md5').update(String(lastUpdated.valueOf())).digest('hex'))
}
