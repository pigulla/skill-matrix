import z from 'zod'

import { EntityIdMarker } from '../id-markers.js'
import { idSchema } from '../id-schema.js'

export const teamIdSchema = idSchema.brand('team-id').meta({
  description: 'The ID of the team.',
  example: `00000000-${EntityIdMarker.TEAM}-4000-8000-000000000000`,
})

export type TeamID = z.infer<typeof teamIdSchema>

export function asTeamID(id: string): TeamID {
  return teamIdSchema.parse(id)
}

export const EXAMPLE_TEAM_ID = asTeamID(`22222222-${EntityIdMarker.TEAM}-4000-8000-111111111111`)
