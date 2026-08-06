import { createZodDto } from 'nestjs-zod'
import { z } from 'zod'

import { proficiencySchema } from '#/domain/skill/proficiency/proficiency.js'
import { EXAMPLE_SKILL_ID, skillIdSchema } from '#/domain/skill/skill-id.js'
import { teamIdSchema } from '#/domain/team/team-id.js'
import { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

const setSkillProficiencyDTOSchema = z
  .strictObject({ proficiency: proficiencySchema })
  .brand('set-skill-proficiency-dto')

const teamSkillProficienciesDTOSchema = z
  .strictObject({
    teamId: teamIdSchema,
    skills: z
      .array(
        z.strictObject({
          skillId: skillIdSchema,
          proficiency: proficiencySchema,
        }),
      )
      .meta({
        description: 'The skill proficiencies associated with this team.',
        example: [{ skillId: EXAMPLE_SKILL_ID, proficiency: 3 }],
      }),
  })
  .brand('team-skill-proficiencies-dto')

export class SetSkillProficiencyDTO extends createZodDto(setSkillProficiencyDTOSchema) {}

export class TeamSkillProficienciesDTO extends createZodDto(teamSkillProficienciesDTOSchema) {}

export function fromDomain(tsp: TeamSkillProficiencies): TeamSkillProficienciesDTO {
  return teamSkillProficienciesDTOSchema.parse({
    teamId: tsp.teamId,
    skills: [...tsp.skills.values()].map(s => ({
      skillId: s.skillId,
      proficiency: s.proficiency,
    })),
  })
}
