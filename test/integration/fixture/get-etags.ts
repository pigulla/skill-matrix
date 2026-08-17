import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import type { Dayjs } from 'dayjs'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import type { TeamID } from '#/domain/team/team-id.js'
import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
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
    db.manyOrNone<{ id: SkillID; last_updated: Dayjs }>('SELECT id, last_updated FROM skills'),
    db.manyOrNone<{ id: ExampleID; last_updated: Dayjs }>('SELECT id, last_updated FROM examples'),
    db.manyOrNone<{ id: ExampleKindID; last_updated: Dayjs }>(
      'SELECT id, last_updated FROM example_kinds',
    ),
    db.manyOrNone<{ id: TeamID; last_updated: Dayjs }>('SELECT id, last_updated FROM teams'),
  ])

  function toEntry(lastUpdated: Dayjs): { etag: ETag; token: ConcurrencyToken } {
    const token = toConcurrencyToken(lastUpdated)
    return { etag: toETag(token), token }
  }

  return {
    skills: Object.fromEntries(skillRows.map(row => [row.id, toEntry(row.last_updated)])),
    examples: Object.fromEntries(exampleRows.map(row => [row.id, toEntry(row.last_updated)])),
    exampleKinds: Object.fromEntries(
      exampleKindRows.map(row => [row.id, toEntry(row.last_updated)]),
    ),
    teams: Object.fromEntries(teamRows.map(row => [row.id, toEntry(row.last_updated)])),
  }
}
