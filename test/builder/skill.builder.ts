import type { ExampleID } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { asSkillID } from '#/domain/skill/skill-id.js'

import { UNKNOWN_SKILL_ID } from '../util/entity-ids.js'

type Properties = {
  id: string
  name: string
  description: string
  exampleIds: ExampleID[]
}

export class SkillBuilder {
  private properties: Properties = {
    id: UNKNOWN_SKILL_ID,
    name: 'Frontend Development',
    description: 'Building modern web user interfaces.',
    exampleIds: [],
  }

  public withId(id: string): this {
    this.properties.id = id
    return this
  }

  public withName(name: string): this {
    this.properties.name = name
    return this
  }

  public withDescription(description: string): this {
    this.properties.description = description
    return this
  }

  public withExamples(examples: Iterable<ExampleID>): this {
    this.properties.exampleIds = [...examples]
    return this
  }

  public with(properties: Partial<Properties>): this {
    this.properties = { ...this.properties, ...properties }
    return this
  }

  public static create<Full extends boolean = false>(
    ...args: Full extends true ? [properties: Properties] : [properties?: Partial<Properties>]
  ): Skill {
    return new SkillBuilder().with(args[0] ?? {}).build()
  }

  public static from(skill: Skill): SkillBuilder {
    return new SkillBuilder().with({
      id: skill.id,
      name: skill.name,
      description: skill.description,
      exampleIds: [...skill.exampleIds],
    })
  }

  public build(): Skill {
    return new Skill({
      id: asSkillID(this.properties.id),
      name: this.properties.name,
      description: this.properties.description,
      exampleIds: new Set(this.properties.exampleIds),
    })
  }
}
