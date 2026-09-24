import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'

import { type ConcurrencyToken, concurrencyTokenSchema } from '#/domain/concurrency-token.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { TeamID } from '#/domain/team/team-id.js'
import { type ETag, toETag } from '#/presentation/http/etag.js'

import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'

export interface ETags {
  skills: Record<SkillID, { etag: ETag; token: ConcurrencyToken }>
  examples: Record<ExampleID, { etag: ETag; token: ConcurrencyToken }>
  exampleKinds: Record<ExampleKindID, { etag: ETag; token: ConcurrencyToken }>
  teams: Record<TeamID, { etag: ETag; token: ConcurrencyToken }>
}

export const STALE_ETAG = toETag(STALE_CONCURRENCY_TOKEN)

export async function getETags(db: Database): Promise<ETags> {
  const [skillRows, exampleRows, exampleKindRows, teamRows] = await Promise.all([
    db.manyOrNone<{ id: SkillID; token: string }>(
      'SELECT id, concurrency_token (version) AS token FROM skills',
    ),
    db.manyOrNone<{ id: ExampleID; token: string }>(
      'SELECT id, concurrency_token (version) AS token FROM examples',
    ),
    db.manyOrNone<{ id: ExampleKindID; token: string }>(
      'SELECT id, concurrency_token (version) AS token FROM example_kinds',
    ),
    db.manyOrNone<{ id: TeamID; token: string }>(
      'SELECT id, concurrency_token (version) AS token FROM teams',
    ),
  ])

  function toEntry(token: string): { etag: ETag; token: ConcurrencyToken } {
    const parsed = concurrencyTokenSchema.parse(token)
    return { etag: toETag(parsed), token: parsed }
  }

  return {
    skills: Object.fromEntries(skillRows.map(row => [row.id, toEntry(row.token)])),
    examples: Object.fromEntries(exampleRows.map(row => [row.id, toEntry(row.token)])),
    exampleKinds: Object.fromEntries(exampleKindRows.map(row => [row.id, toEntry(row.token)])),
    teams: Object.fromEntries(teamRows.map(row => [row.id, toEntry(row.token)])),
  }
}
