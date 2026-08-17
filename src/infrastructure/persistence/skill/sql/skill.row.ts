import z from 'zod'

import { exampleIdSchema } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { skillIdSchema } from '#/domain/skill/skill-id.js'
import { dayjsSchema } from '#/util/dayjs.schema.js'

import { toConcurrencyToken } from '../../concurrency-token.codec.js'

const skillRowSchema = z.strictObject({
  id: skillIdSchema,
  name: z.string(),
  description: z.string(),
  last_updated: dayjsSchema,
})

export const skillWithExampleIdsRow = skillRowSchema
  .extend({
    example_ids: z.array(exampleIdSchema).refine(ids => new Set(ids).size === ids.length, {
      message: 'Duplicate example IDs in view result',
    }),
  })
  .transform(data => ({
    ...data,
    toDomain: () =>
      new Skill({
        id: data.id,
        name: data.name,
        description: data.description,
        exampleIds: new Set(data.example_ids),
      }),
    getConcurrencyToken: () => toConcurrencyToken(data.last_updated),
  }))
  .readonly()
  .brand('skill-with-examples-row')

export const skillUpdateRow = z
  .union([z.strictObject({ id: skillIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('skill-update-row')

export const skillDeleteRow = z
  .union([z.strictObject({ id: skillIdSchema }), z.strictObject({ id: z.null() })])
  .readonly()
  .brand('skill-delete-row')
