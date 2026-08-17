import { createZodDto } from 'nestjs-zod'

import {
  TeamSkillProficiencies,
  teamSkillProficienciesSchema,
} from '#/domain/team/skill-proficiencies/team-skill-proficiencies.js'

const teamSkillProficienciesDTOSchema = teamSkillProficienciesSchema
  .pick({ teamId: true, skills: true })
  .strict()
  .brand('team-skill-proficiencies-dto')

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
