import { createZodDto } from 'nestjs-zod'

import { skillProficiencySchema } from '#/domain/skill/proficiency/skill-proficiency.js'

const createSkillProficiencyDTOSchema = skillProficiencySchema
  .pick({ proficiency: true })
  .strict()
  .brand('create-skill-proficiency-dto')

const updateSkillProficiencyDTOSchema = createSkillProficiencyDTOSchema.brand(
  'update-skill-proficiency-dto',
)

export class CreateSkillProficiencyDTO extends createZodDto(createSkillProficiencyDTOSchema) {}

export class UpdateSkillProficiencyDTO extends createZodDto(updateSkillProficiencyDTOSchema) {}
