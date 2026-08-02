import z from 'zod'

import { exampleKindSchema } from '#/domain/example-kind/example-kind.js'

export const exampleKindRow = z
  .strictObject({
    kind: exampleKindSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => data.kind,
  }))
  .readonly()
  .brand<'example-kind-row'>('example-kind-row')
