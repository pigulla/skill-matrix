import z from 'zod'

import { concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

export const exampleKindRow = z
  .strictObject({
    id: exampleKindIdSchema,
    name: z.string(),
    concurrency_token: concurrencyTokenSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new ExampleKind({ id: data.id, name: data.name }),
    getConcurrencyToken: () => data.concurrency_token,
  }))
  .readonly()
  .brand('example-kind-row')

export const exampleKindUpdateRow = z
  .union([
    z.strictObject({
      id: exampleKindIdSchema,
      name: z.string(),
      concurrency_token: concurrencyTokenSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      concurrency_token: z.null(),
    }),
  ])
  .readonly()
  .brand('example-kind-update-row')

export const exampleKindDeleteRow = z
  .union([z.strictObject({ id: exampleKindIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-kind-delete-row')
