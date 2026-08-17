import z from 'zod'

import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

import { toConcurrencyToken } from '../../../concurrency-token.codec.js'

export const exampleKindRow = z
  .strictObject({
    id: exampleKindIdSchema,
    name: z.string(),
    last_updated: dayjsSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new ExampleKind({ id: data.id, name: data.name }),
    getConcurrencyToken: () => toConcurrencyToken(data.last_updated),
  }))
  .readonly()
  .brand('example-kind-row')

export const exampleKindUpdateRow = z
  .union([
    z.strictObject({
      id: exampleKindIdSchema,
      name: z.string(),
      last_updated: dayjsSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      last_updated: z.null(),
    }),
  ])
  .readonly()
  .brand('example-kind-update-row')

export const exampleKindDeleteRow = z
  .union([z.strictObject({ id: exampleKindIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-kind-delete-row')
