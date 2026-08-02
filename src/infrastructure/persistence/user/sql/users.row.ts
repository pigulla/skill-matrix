import z from 'zod'

import { teamIdSchema } from '#/domain/team/team-id.js'
import { User } from '#/domain/user/user.js'
import { userIdSchema } from '#/domain/user/user-id.js'

export const usersRow = z
  .strictObject({
    id: userIdSchema,
    email: z.string(),
    first_name: z.string(),
    last_name: z.string(),
    team_id: teamIdSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => {
      const { last_name: lastName, first_name: firstName, team_id: teamId, ...other } = data
      return new User({ firstName, lastName, teamId, ...other })
    },
  }))
  .readonly()
  .brand<'users-row'>('users-row')
