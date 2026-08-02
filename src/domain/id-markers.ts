import type { DigitCharacter } from 'type-fest'

type HexCharacter = DigitCharacter | 'a' | 'b' | 'c' | 'd' | 'e' | 'f'
type EntityIdMarkerValue = `${HexCharacter}${HexCharacter}${HexCharacter}${HexCharacter}`

// Entity ID markers are a pure developer-experience feature. There is no technical
// justification for them — if anything they are a hindrance, because they prevent
// Postgres from generating UUIDs autonomously (e.g. via gen_random_uuid()). We
// currently generate IDs in application code anyway, primarily for testability, so
// the cost is zero today. If that ever changes, these markers should be removed.

// TODO: Marker values are a generation concern and arguably belong in the infrastructure
// layer. Deferred in favour of simplicity for now.
export const EntityIdMarker = {
  USER: '0001',
  TEAM: '0002',
  SKILL: '0003',
  EXAMPLE: '0004',
} as const satisfies Record<string, EntityIdMarkerValue>
