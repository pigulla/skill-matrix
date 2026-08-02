import { createZodDto } from 'nestjs-zod'

import { Team, teamSchema } from '#/domain/team/team.js'

const updateTeamDTOSchema = teamSchema.brand<'update-team-dto'>('update-team-dto')

const createTeamDTOSchema = updateTeamDTOSchema
  .omit({ id: true })
  .brand<'create-team-dto'>('create-team-dto')

const teamDTOSchema = updateTeamDTOSchema.brand<'team-dto'>('team-dto')

export class CreateTeamDTO extends createZodDto(createTeamDTOSchema) {}

export class UpdateTeamDTO extends createZodDto(updateTeamDTOSchema) {}

export class TeamDTO extends createZodDto(teamDTOSchema) {}

export function fromDomain(team: Team): TeamDTO {
  return teamDTOSchema.parse({
    id: team.id,
    name: team.name,
  })
}

export function toDomain(team: TeamDTO | UpdateTeamDTO): Team {
  return new Team(team)
}
