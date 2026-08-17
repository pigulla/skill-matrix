import z from 'zod'

import { EntityIdMarker } from '../id-markers.js'
import { idSchema } from '../id-schema.js'

export const skillIdSchema = idSchema
  .refine(id => id.split('-')[1] === EntityIdMarker.SKILL, {
    message: `ID must have marker '${EntityIdMarker.SKILL}' in the second segment`,
  })
  .brand('skill-id')
  .meta({
    description: 'The ID of the skill.',
    example: `33333333-${EntityIdMarker.SKILL}-4000-8000-111111111111`,
  })

export type SkillID = z.infer<typeof skillIdSchema>

export function asSkillID(id: string): SkillID {
  return skillIdSchema.parse(id)
}

export const EXAMPLE_SKILL_ID = asSkillID(`33333333-${EntityIdMarker.SKILL}-4000-8000-111111111111`)
