import z from 'zod'

import { Example } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

import { toConcurrencyToken } from '../../concurrency-token.codec.js'

export const exampleRow = z
  .strictObject({
    id: exampleIdSchema,
    name: z.string(),
    example_kind_id: exampleKindIdSchema,
    url: z.string().nullable(),
    last_updated: dayjsSchema,
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
    getConcurrencyToken: () => toConcurrencyToken(data.last_updated),
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
      last_updated: dayjsSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      example_kind_id: z.null(),
      url: z.null(),
      last_updated: z.null(),
    }),
  ])
  .readonly()
  .brand('example-update-row')

export const exampleDeleteRow = z
  .union([z.strictObject({ id: exampleIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('example-delete-row')
