import { createZodDto } from 'nestjs-zod'

import { Team, teamSchema } from '#/domain/team/team.js'

const createTeamDTOSchema = teamSchema.pick({ name: true }).strict().brand('create-team-dto')

const updateTeamDTOSchema = teamSchema
  .pick({ id: true, name: true })
  .strict()
  .brand('update-team-dto')

const teamDTOSchema = updateTeamDTOSchema.brand('team-dto')

export class CreateTeamDTO extends createZodDto(createTeamDTOSchema) {}

export class UpdateTeamDTO extends createZodDto(updateTeamDTOSchema) {}

export class TeamDTO extends createZodDto(teamDTOSchema) {}

export function fromDomain(team: Team): TeamDTO {
  return teamDTOSchema.parse({
    id: team.id,
    name: team.name,
  })
}
