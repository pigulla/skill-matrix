import z from 'zod'

import { Team } from '#/domain/team/team.js'
import { teamIdSchema } from '#/domain/team/team-id.js'

export const teamsRow = z
  .strictObject({
    id: teamIdSchema,
    name: z.string(),
  })
  .transform(data => ({
    ...data,
    toDomain: () => new Team({ ...data }),
  }))
  .readonly()
  .brand<'teams-row'>('teams-row')
