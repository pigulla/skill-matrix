import z from 'zod'

import { Example } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

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
  }))
  .readonly()
  .brand('example-row')
