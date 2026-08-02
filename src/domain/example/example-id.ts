import z from 'zod'

import { EntityIdMarker } from '../id-markers.js'
import { idSchema } from '../id-schema.js'

export const exampleIdSchema = idSchema
  .refine(id => id.split('-')[1] === EntityIdMarker.EXAMPLE, {
    message: `ID must have marker '${EntityIdMarker.EXAMPLE}' in the second segment`,
  })
  .brand<'example-id'>()
  .meta({
    description: 'The ID of the example.',
    example: `00000000-${EntityIdMarker.EXAMPLE}-4000-8000-000000000000`,
  })

export type ExampleID = z.infer<typeof exampleIdSchema>

export function asExampleID(id: string): ExampleID {
  return exampleIdSchema.parse(id)
}
