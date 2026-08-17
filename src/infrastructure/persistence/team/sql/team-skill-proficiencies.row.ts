import z from 'zod'

import { proficiencySchema } from '#/domain/skill/proficiency/proficiency.js'
import { SkillProficiency } from '#/domain/skill/proficiency/skill-proficiency.js'
import { skillIdSchema } from '#/domain/skill/skill-id.js'
import { TeamSkillProficiencies } from '#/domain/team/skill-proficiencies/team-skill-proficiencies.js'
import { teamIdSchema } from '#/domain/team/team-id.js'

export const teamSkillProficienciesRow = z
  .strictObject({
    team_id: teamIdSchema,
    skill_proficiencies: z.array(z.tuple([skillIdSchema, proficiencySchema])),
  })
  .transform(data => ({
    ...data,
    toDomain: () =>
      new TeamSkillProficiencies({
        teamId: data.team_id,
        skills: data.skill_proficiencies.map(
          ([skillId, proficiency]) => new SkillProficiency({ skillId, proficiency }),
        ),
      }),
  }))
  .readonly()
  .brand('team-skill-proficiencies-row')
