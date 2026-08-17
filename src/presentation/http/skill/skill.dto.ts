import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { EXAMPLE_EXAMPLE_ID, exampleIdSchema } from '#/domain/example/example-id.js'
import { Skill, skillSchema } from '#/domain/skill/skill.js'

const exampleIdsDTOSchema = z
  .array(exampleIdSchema)
  .refine(ids => new Set(ids).size === ids.length, { message: 'Example ids must be unique' })
  .meta({
    description: 'The ids of the examples associated with this skill.',
    example: [EXAMPLE_EXAMPLE_ID],
    uniqueItems: true,
  })
  .brand('example-ids-dto')

const createSkillDTOSchema = skillSchema
  .pick({
    name: true,
    description: true,
  })
  .extend({ exampleIds: exampleIdsDTOSchema })
  .strict()
  .brand('create-skill-dto')

const updateSkillDTOSchema = skillSchema
  .pick({
    id: true,
    name: true,
    description: true,
  })
  .extend({ exampleIds: exampleIdsDTOSchema })
  .strict()
  .brand('update-skill-dto')

const skillDTOSchema = updateSkillDTOSchema.brand('skill-dto')

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
