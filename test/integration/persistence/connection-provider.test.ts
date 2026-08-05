import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { ConnectionProvider } from '#/infrastructure/persistence/connection-provider.js'

import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ConnectionProvider', () => {
  let app: INestApplication

  describe('when connection to Postgres 18', () => {
    const integrationTest = setupIntegrationTest()

    beforeAll(integrationTest.beforeAll)
    afterAll(integrationTest.afterAll)
    beforeEach(integrationTest.beforeEach)

    afterEach(async () => {
      await app?.close()
      await integrationTest.afterEach()
    })

    it('should connect to the database', async () => {
      const module = await integrationTest
        .createModule({ testName: ConnectionProvider.name })
        .compile()

      await expect(
        (async () => {
          app = module.createNestApplication().enableShutdownHooks()
          await app.init()
        })(),
      ).resolves.not.toThrow()
    })
  })

  describe('when connection to Postgres 17', () => {
    const integrationTest = setupIntegrationTest({ postgresVersion: 17 })

    beforeAll(integrationTest.beforeAll)
    afterAll(integrationTest.afterAll)
    beforeEach(integrationTest.beforeEach)

    afterEach(async () => {
      await app?.close()
      await integrationTest.afterEach()
    })

    it('should throw', async () => {
      const module = await integrationTest
        .createModule({ testName: ConnectionProvider.name })
        .compile()

      await expect(
        (async () => {
          app = module.createNestApplication().enableShutdownHooks()
          await app.init()
        })(),
      ).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
