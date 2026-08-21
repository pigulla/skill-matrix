import z from 'zod'

// The MD5 hash is an opacity measure against casual decoding, not a cryptographic secret — the pre-image is just a
// small, monotonically increasing integer (the row's version), so early revisions of any row are enumerable via a
// widely-published md5(small-integer) table, no timing knowledge needed at all.
export const concurrencyTokenSchema = z.hash('md5').brand('concurrency-token')

export type ConcurrencyToken = z.infer<typeof concurrencyTokenSchema>

export function asConcurrencyToken(value: string): ConcurrencyToken {
  return concurrencyTokenSchema.parse(value)
}
