/* v8 ignore file -- @preserve */

import type { ConcurrencyToken } from './concurrency-token.js'

export interface WithConcurrencyToken<T> {
  readonly value: T
  readonly token: ConcurrencyToken
}
