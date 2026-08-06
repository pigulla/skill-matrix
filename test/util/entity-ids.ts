import { asExampleID } from '#/domain/example/example-id.js'
import { asExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import { EntityIdMarker } from '#/domain/id-markers.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { asUserID } from '#/domain/user/user-id.js'

// These are ids not used in the fixture.

export const UNKNOWN_EXAMPLE_ID = asExampleID(
  `00000000-${EntityIdMarker.EXAMPLE}-4000-8000-000000000000`,
)
export const UNKNOWN_EXAMPLE_KIND_ID = asExampleKindID(
  `00000000-${EntityIdMarker.EXAMPLE_KIND}-4000-8000-000000000000`,
)
export const UNKNOWN_SKILL_ID = asSkillID(`00000000-${EntityIdMarker.SKILL}-4000-8000-000000000000`)
export const UNKNOWN_TEAM_ID = asTeamID(`00000000-${EntityIdMarker.TEAM}-4000-8000-000000000000`)
export const UNKNOWN_USER_ID = asUserID(`00000000-${EntityIdMarker.USER}-4000-8000-000000000000`)
