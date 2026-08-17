import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import dayjs from 'dayjs'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { toConcurrencyToken } from '#/infrastructure/persistence/concurrency-token.codec.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'

import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('concurrency_token() parity between TypeScript and Postgres', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({ testName: 'ConcurrencyTokenParity' })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  it.each<string>([
    '1970-01-01T00:00:00.000Z',
    '1970-01-01T00:00:00.001Z',
    '2026-01-01T00:00:00.000Z',
    '2026-01-01T00:00:00.001Z',
  ])('should compute the same token in TypeScript and in Postgres for "%s"', async timestamp => {
    const fromTypescript = toConcurrencyToken(dayjs(timestamp))
    const { fromPostgres } = await db.one<{ fromPostgres: string }>(
      'SELECT concurrency_token($(timestamp)::TIMESTAMPTZ) AS "fromPostgres"',
      { timestamp },
    )

    expect(fromPostgres).toBe(fromTypescript)
  })
})
