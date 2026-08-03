import z from 'zod'

export const exampleKindSchema = z.string().min(1).brand('example-kind').meta({
  description: 'The kind of example.',
  example: 'technology',
})

export type ExampleKind = z.infer<typeof exampleKindSchema>

export function asExampleKind(kind: string): ExampleKind {
  return exampleKindSchema.parse(kind)
}
