import z from 'zod'

import { concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import { Example } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

export const exampleRow = z
  .strictObject({
    id: exampleIdSchema,
    name: z.string(),
    example_kind_id: exampleKindIdSchema,
    url: z.string().nullable(),
    concurrency_token: concurrencyTokenSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () =>
      new Example({
        id: data.id,
        name: data.name,
        exampleKindId: data.example_kind_id,
        url: data.url,
      }),
    getConcurrencyToken: () => data.concurrency_token,
  }))
  .readonly()
  .brand('example-row')

export const exampleUpdateRow = z
  .union([
    z.strictObject({
      id: exampleIdSchema,
      name: z.string(),
      example_kind_id: exampleKindIdSchema,
      url: z.string().nullable(),
      concurrency_token: concurrencyTokenSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      example_kind_id: z.null(),
      url: z.null(),
      concurrency_token: z.null(),
    }),
  ])
  .readonly()
  .brand('example-update-row')

export const exampleDeleteRow = z
  .union([z.strictObject({ id: exampleIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-delete-row')
