import z from 'zod'

import { idSchema } from '../id-schema.js'

export const exampleIdSchema = idSchema.brand('example-id').meta({
  description: 'The ID of the example.',
  example: '44444444-0004-4000-8000-111111111111',
})

export type ExampleID = z.infer<typeof exampleIdSchema>

export function asExampleID(id: string): ExampleID {
  return exampleIdSchema.parse(id)
}

export const EXAMPLE_EXAMPLE_ID = asExampleID('44444444-0004-4000-8000-111111111111')
