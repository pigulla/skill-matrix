import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { EXAMPLE_EXAMPLE_ID, exampleIdSchema } from '#/domain/example/example-id.js'
import { Skill, skillSchema } from '#/domain/skill/skill.js'

const updateSkillDTOSchema = z
  .strictObject(skillSchema.shape)
  .extend({
    exampleIds: z
      .array(exampleIdSchema)
      .refine(ids => new Set(ids).size === ids.length, { message: 'Example ids must be unique' })
      .meta({
        description: 'The ids of the examples associated with this skill.',
        example: [EXAMPLE_EXAMPLE_ID],
        uniqueItems: true,
      }),
  })
  .brand('update-skill-dto')

const createSkillDTOSchema = updateSkillDTOSchema.omit({ id: true }).brand('create-skill-dto')

const skillDTOSchema = z
  .strictObject({
    ...createSkillDTOSchema.shape,
    ...skillSchema.pick({ id: true }).shape,
  })
  .brand('skill-dto')

export class CreateSkillDTO extends createZodDto(createSkillDTOSchema) {}

export class UpdateSkillDTO extends createZodDto(updateSkillDTOSchema) {}

export class SkillDTO extends createZodDto(skillDTOSchema) {}

export function fromDomain(skill: Skill): SkillDTO {
  return skillDTOSchema.parse({
    id: skill.id,
    name: skill.name,
    description: skill.description,
    exampleIds: [...skill.exampleIds],
  })
}
