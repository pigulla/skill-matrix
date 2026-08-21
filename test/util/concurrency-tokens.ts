import { createHash } from 'node:crypto'

import { asConcurrencyToken } from '#/domain/concurrency-token.js'

// Well-formed but guaranteed not to match any row: real versions are always >= 1 (see the `version` column's
// DEFAULT in the migration) and only ever increase, so 0 never occurs, regardless of what the actual starting
// value happens to be. Hashed directly here, rather than via a shared codec, because production code never
// hashes a version in TypeScript at all — only Postgres's concurrency_token() does that.
export const STALE_CONCURRENCY_TOKEN = asConcurrencyToken(
  createHash('md5').update('0').digest('hex'),
)
