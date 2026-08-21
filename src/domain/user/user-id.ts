import z from 'zod'

import { EntityIdMarker } from '../id-markers.js'
import { idSchema } from '../id-schema.js'

export const userIdSchema = idSchema.brand('user-id').meta({
  description: 'The ID of the user.',
  example: `00000000-${EntityIdMarker.USER}-4000-8000-000000000000`,
})

export type UserID = z.infer<typeof userIdSchema>

export function asUserID(id: string): UserID {
  return userIdSchema.parse(id)
}

export const EXAMPLE_USER_ID = asUserID(`11111111-${EntityIdMarker.USER}-4000-8000-111111111111`)
