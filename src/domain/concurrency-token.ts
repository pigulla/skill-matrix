import z from 'zod'

// The MD5 hash is an opacity measure against casual decoding, not a cryptographic secret — the pre-image is just an
// epoch-millisecond integer, so it is brute-forceable by anyone with a rough idea of when the row last changed.
export const concurrencyTokenSchema = z.hash('md5').brand('concurrency-token')

export type ConcurrencyToken = z.infer<typeof concurrencyTokenSchema>

export function asConcurrencyToken(value: string): ConcurrencyToken {
  return concurrencyTokenSchema.parse(value)
}
