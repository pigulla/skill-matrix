import z from 'zod'

import { proficiencySchema } from '#/domain/skill/proficiency.js'
import { skillIdSchema } from '#/domain/skill/skill-id.js'
import { SkillProficiency } from '#/domain/skill/skill-proficiency.js'
import { teamIdSchema } from '#/domain/team/team-id.js'
import { TeamSkillProficiencies } from '#/domain/team/team-skill-proficiencies.js'

export const teamSkillProficiencyRow = z
  .strictObject({
    team_id: teamIdSchema,
    skill_proficiencies: z.array(z.tuple([skillIdSchema, proficiencySchema])),
  })
  .transform(data => ({
    ...data,
    toDomain: () =>
      new TeamSkillProficiencies({
        teamId: data.team_id,
        items: data.skill_proficiencies.map(
          ([skillId, proficiency]) => new SkillProficiency({ skillId, proficiency }),
        ),
      }),
  }))
  .readonly()
  .brand('team-skill-proficiencies-row')
