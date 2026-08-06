import z from 'zod'

import { ExampleKind } from '#/domain/example/kind/example-kind.js'
import { exampleKindIdSchema } from '#/domain/example/kind/example-kind-id.js'

export const exampleKindsRow = z
  .strictObject({
    id: exampleKindIdSchema,
    name: z.string(),
  })
  .transform(data => ({
    ...data,
    toDomain: () => new ExampleKind({ ...data }),
  }))
  .readonly()
  .brand('example-kinds-row')
