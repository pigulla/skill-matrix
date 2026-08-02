import type { JsonObject } from 'type-fest'
import z from 'zod'

import { type ExampleKind, exampleKindSchema } from '../example-kind/example-kind.js'

import { InvalidExampleError } from './error/invalid-example.error.js'
import { type ExampleID, exampleIdSchema } from './example-id.js'

export const exampleSchema = z.object({
  id: exampleIdSchema,
  name: z.string().min(1).meta({
    description: 'The display name of the example.',
    example: 'NestJS',
  }),
  kind: exampleKindSchema,
  url: z.url().nullable().meta({
    description: 'An optional URL for the example, or null.',
    example: 'https://nestjs.com',
  }),
})

export class Example {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(Example.name)

  public readonly id: ExampleID
  public readonly name: string
  public readonly kind: ExampleKind
  public readonly url: string | null

  public constructor(data: { id: ExampleID; name: string; kind: ExampleKind; url: string | null }) {
    const result = exampleSchema.safeParse(data)

    if (result.error) {
      throw new InvalidExampleError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
    this.kind = result.data.kind
    this.url = result.data.url
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
      kind: this.kind,
      url: this.url,
    }
  }
}
