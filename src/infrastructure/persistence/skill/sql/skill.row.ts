import z from 'zod'

import { concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import { exampleIdSchema } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { skillIdSchema } from '#/domain/skill/skill-id.js'

const skillRowSchema = z.strictObject({
  id: skillIdSchema,
  name: z.string(),
  description: z.string(),
  concurrency_token: concurrencyTokenSchema,
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
    getConcurrencyToken: () => data.concurrency_token,
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
