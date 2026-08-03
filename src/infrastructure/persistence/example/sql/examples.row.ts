import z from 'zod'

import { Example } from '#/domain/example/example.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'
import { exampleKindSchema } from '#/domain/example-kind/example-kind.js'

export const exampleRow = z
  .strictObject({
    id: exampleIdSchema,
    name: z.string(),
    kind: exampleKindSchema,
    url: z.string().nullable(),
  })
  .transform(data => ({
    ...data,
    toDomain: () => new Example({ id: data.id, name: data.name, kind: data.kind, url: data.url }),
  }))
  .readonly()
  .brand('example-row')
