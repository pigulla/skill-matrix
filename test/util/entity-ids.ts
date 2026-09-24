import { asExampleID } from '#/domain/example/example-id.js'
import { asExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { asUserID } from '#/domain/user/user-id.js'

// These are ids not used in the fixture.

export const UNKNOWN_EXAMPLE_ID = asExampleID('00000000-0004-4000-8000-000000000000')
export const UNKNOWN_EXAMPLE_KIND_ID = asExampleKindID('00000000-0005-4000-8000-000000000000')
export const UNKNOWN_SKILL_ID = asSkillID('00000000-0003-4000-8000-000000000000')
export const UNKNOWN_TEAM_ID = asTeamID('00000000-0002-4000-8000-000000000000')
export const UNKNOWN_USER_ID = asUserID('00000000-0001-4000-8000-000000000000')
