import z from 'zod'

import { EntityIdMarker } from '../../id-markers.js'
import { idSchema } from '../../id-schema.js'

export const exampleKindIdSchema = idSchema
  .refine(id => id.split('-')[1] === EntityIdMarker.EXAMPLE_KIND, {
    message: `ID must have marker '${EntityIdMarker.EXAMPLE_KIND}' in the second segment`,
  })
  .brand('kind-id')
  .meta({
    description: 'The ID of the example kind.',
    example: `00000000-${EntityIdMarker.EXAMPLE_KIND}-4000-8000-000000000000`,
  })

export type ExampleKindID = z.infer<typeof exampleKindIdSchema>

export function asExampleKindID(id: string): ExampleKindID {
  return exampleKindIdSchema.parse(id)
}

export const EXAMPLE_EXAMPLE_KIND_ID = asExampleKindID(
  `55555555-${EntityIdMarker.EXAMPLE_KIND}-4000-8000-111111111111`,
)
