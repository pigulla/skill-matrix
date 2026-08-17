import { createHash } from 'node:crypto'

import z from 'zod'

import { asConcurrencyToken, type ConcurrencyToken } from '#/domain/concurrency-token.js'

const etagSchema = z
  .string()
  .regex(/^W\/".+"$/, 'ETag must be weak')
  .brand('etag')

export type ETag = z.infer<typeof etagSchema>

export const EXAMPLE_ETAG = toETag(asConcurrencyToken(createHash('md5').update('').digest('hex')))

function asETag(value: string): ETag {
  return etagSchema.parse(value)
}

export function toETag(token: ConcurrencyToken): ETag {
  return asETag(`W/"${token}"`)
}
