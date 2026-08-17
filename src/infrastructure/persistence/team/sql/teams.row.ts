import z from 'zod'

import { Team } from '#/domain/team/team.js'
import { teamIdSchema } from '#/domain/team/team-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

import { toConcurrencyToken } from '../../concurrency-token.codec.js'

export const teamsRow = z
  .strictObject({
    id: teamIdSchema,
    name: z.string(),
    last_updated: dayjsSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new Team({ id: data.id, name: data.name }),
    getConcurrencyToken: () => toConcurrencyToken(data.last_updated),
  }))
  .readonly()
  .brand('teams-row')

export const teamsUpdateRow = z
  .union([
    z.strictObject({
      id: teamIdSchema,
      name: z.string(),
      last_updated: dayjsSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      last_updated: z.null(),
    }),
  ])
  .readonly()
  .brand('teams-update-row')

export const teamsDeleteRow = z
  .union([z.strictObject({ id: teamIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('teams-delete-row')
