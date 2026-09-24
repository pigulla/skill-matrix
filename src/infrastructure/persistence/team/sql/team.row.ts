import z from 'zod'

import { concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import { Team } from '#/domain/team/team.js'
import { teamIdSchema } from '#/domain/team/team-id.js'

export const teamRow = z
  .strictObject({
    id: teamIdSchema,
    name: z.string(),
    concurrency_token: concurrencyTokenSchema,
  })
  .transform(data => ({
    ...data,
    toDomain: () => new Team({ id: data.id, name: data.name }),
    getConcurrencyToken: () => data.concurrency_token,
  }))
  .readonly()
  .brand('team-row')

export const teamUpdateRow = z
  .union([
    z.strictObject({
      id: teamIdSchema,
      name: z.string(),
      concurrency_token: concurrencyTokenSchema,
    }),
    z.strictObject({
      id: z.null(),
      name: z.null(),
      concurrency_token: z.null(),
    }),
  ])
  .readonly()
  .brand('team-update-row')

export const teamDeleteRow = z
  .union([z.strictObject({ id: teamIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('team-delete-row')
