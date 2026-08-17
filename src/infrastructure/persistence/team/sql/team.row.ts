import z from 'zod'

import { Team } from '#/domain/team/team.js'
import { teamIdSchema } from '#/domain/team/team-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

import { toConcurrencyToken } from '../../concurrency-token.codec.js'

export const teamRow = z
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
  .brand('team-row')

export const teamUpdateRow = z
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
  .brand('team-update-row')

export const teamDeleteRow = z
  .union([z.strictObject({ id: teamIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('team-delete-row')
