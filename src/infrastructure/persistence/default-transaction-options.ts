/* v8 ignore file -- @preserve */

import pgPromise from 'pg-promise'

export const DEFAULT_TX_OPTIONS = {
  mode: new pgPromise.txMode.TransactionMode({
    tiLevel: pgPromise.txMode.isolationLevel.serializable,
  }),
}
