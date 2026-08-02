import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { exampleIdSchema } from '#/domain/example/example-id.js'
import { EntityIdMarker } from '#/domain/id-markers.js'
import { Skill, skillSchema } from '#/domain/skill/skill.js'

const updateSkillDTOSchema = skillSchema
  .extend({
    exampleIds: z
      .array(exampleIdSchema)
      .refine(ids => new Set(ids).size === ids.length, { message: 'Example ids must be unique' })
      .meta({
        description: 'The ids of the examples associated with this skill.',
        example: [`00000000-${EntityIdMarker.EXAMPLE}-4000-8000-000000000000`],
      }),
  })
  .brand<'create-skill-dto'>('create-skill-dto')

const createSkillDTOSchema = updateSkillDTOSchema
  .omit({ id: true })
  .brand<'update-skill-dto'>('update-skill-dto')

const skillDTOSchema = z
  .strictObject({
    ...createSkillDTOSchema.shape,
    ...skillSchema.pick({ id: true }).shape,
  })
  .brand<'skill-dto'>('skill-dto')

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
