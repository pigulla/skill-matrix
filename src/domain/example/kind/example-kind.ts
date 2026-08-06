import type { Except, JsonObject } from 'type-fest'
import z from 'zod'

import { InvalidExampleKindError } from './error/invalid-example-kind.error.js'
import { type ExampleKindID, exampleKindIdSchema } from './example-kind-id.js'

export const exampleKindSchema = z.object({
  id: exampleKindIdSchema,
  name: z.string().min(1).meta({
    description: 'The name of the example kind.',
    example: 'Technology',
  }),
})

export type Properties = z.infer<typeof exampleKindSchema>

export class ExampleKind implements Properties {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(ExampleKind.name)

  public readonly id: ExampleKindID
  public readonly name: string

  public constructor(data: { id: ExampleKindID; name: string }) {
    const result = exampleKindSchema.safeParse(data)

    if (result.error) {
      throw new InvalidExampleKindError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
  }

  public update(data: Partial<Except<Properties, 'id'>>): ExampleKind {
    // Let's not rely on TypeScript only. The id should never be accidentally overwritten.
    return new ExampleKind({ ...this, ...data, id: this.id })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
    }
  }
}
