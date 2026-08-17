import type { Except, JsonObject } from 'type-fest'
import z from 'zod'

import { type ExampleID, exampleIdSchema } from '../example/example-id.js'

import { InvalidSkillError } from './error/invalid-skill.error.js'
import { type SkillID, skillIdSchema } from './skill-id.js'

export const skillSchema = z.object({
  id: skillIdSchema,
  name: z.string().min(1).meta({
    description: 'The name of the skill.',
    example: 'Backend Development',
  }),
  description: z.string().min(1).meta({
    description: 'A description of the skill.',
    example: 'Designing and building server-side services.',
  }),
  exampleIds: z
    .set(exampleIdSchema)
    .meta({
      description: 'The ids of the examples associated with this skill.',
    })
    .readonly(),
})

export type Properties = z.infer<typeof skillSchema>

export class Skill implements Properties {
  // biome-ignore lint/correctness/noUnusedPrivateClassMembers: Disable structural typing.
  readonly #brand = Symbol.for(Skill.name)

  public readonly id: SkillID
  public readonly name: string
  public readonly description: string
  public readonly exampleIds: ReadonlySet<ExampleID>

  public constructor(properties: Properties) {
    const result = skillSchema.safeParse(properties)

    /* v8 ignore next -- @preserve */
    if (result.error) {
      throw new InvalidSkillError(result.error)
    }

    this.id = result.data.id
    this.name = result.data.name
    this.description = result.data.description
    this.exampleIds = new Set(result.data.exampleIds)
  }

  public update(properties: Partial<Except<Properties, 'id'>>): Skill {
    // Let's not rely on TypeScript only. The id should never be accidentally overwritten.
    return new Skill({ ...this, ...properties, id: this.id })
  }

  public toJSON(): JsonObject {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      exampleIds: [...this.exampleIds],
    }
  }
}
