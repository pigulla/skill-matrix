import z from 'zod'

import { exampleIdSchema } from '#/domain/example/example-id.js'
import { Skill } from '#/domain/skill/skill.js'
import { skillIdSchema } from '#/domain/skill/skill-id.js'

const skillsRowSchema = z.strictObject({
  id: skillIdSchema,
  name: z.string(),
  description: z.string(),
})

export const skillWithExampleIdsRow = skillsRowSchema
  .extend({
    examples: z.array(exampleIdSchema).refine(ids => new Set(ids).size === ids.length, {
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
        exampleIds: new Set(data.examples),
      }),
  }))
  .readonly()
  .brand('skill-with-examples-row')
