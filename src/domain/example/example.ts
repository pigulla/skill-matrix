import type { Except, JsonObject } from 'type-fest'
import z from 'zod'

import { InvalidExampleError } from './error/invalid-example.error.js'
import { type ExampleID, exampleIdSchema } from './example-id.js'
import { type ExampleKindID, exampleKindIdSchema } from './kind/example-kind-id.js'

export const exampleSchema = z.object({
  id: exampleIdSchema,
  name: z.string().min(1).meta({
    description: 'The display name of the example.',
    example: 'NestJS',
  }),
  exampleKindId: exampleKindIdSchema,
  url: z.url().nullable().meta({
    description: 'An optional URL for the example, or null.',
    example: 'https://nestjs.com',
  }),
})

export type Properties = z.infer<typeof exampleSchema>

export class Example implements Properties {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(Example.name)

  public readonly id: ExampleID
  public readonly name: string
  public readonly exampleKindId: ExampleKindID
  public readonly url: string | null

  public constructor(properties: Properties) {
    const result = exampleSchema.safeParse(properties)

    /* v8 ignore next -- @preserve */
    if (result.error) {
      throw new InvalidExampleError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
    this.exampleKindId = result.data.exampleKindId
    this.url = result.data.url
  }

  public update(properties: Partial<Except<Properties, 'id'>>): Example {
    // Let's not rely on TypeScript only. The id should never be accidentally overwritten.
    return new Example({ ...this, ...properties, id: this.id })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
      exampleKindId: this.exampleKindId,
      url: this.url,
    }
  }
}
