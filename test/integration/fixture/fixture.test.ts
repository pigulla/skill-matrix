import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example-kind/example-kind.repository.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { UserRepository } from '#/infrastructure/persistence/user/user.repository.js'

import { byId } from '../../util/sort-by-id.js'

import { exampleKinds, examples, skills, teams, users } from './fixture.js'
import { setupDatabaseIntegrationTest } from './setup-database-integration-test.js'

describe('Data in the SQL fixture', () => {
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: 'fixtureData',
        providers: [
          SkillRepository,
          ExampleRepository,
          ExampleKindRepository,
          UserRepository,
          TeamRepository,
        ],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  it('should match the modeled examples', async () => {
    const all = (await app.get(ExampleRepository).getAll())._unsafeUnwrap()
    expect(all.sort(byId)).toEqual(Object.values(examples).sort(byId))
  })

  it('should match the modeled skills', async () => {
    const all = (await app.get(SkillRepository).getAll())._unsafeUnwrap()
    expect(all.sort(byId)).toEqual(Object.values(skills).sort(byId))
  })

  it('should match the modeled example kinds', async () => {
    const all = (await app.get(ExampleKindRepository).getAll())._unsafeUnwrap()
    expect(all.sort()).toEqual(Object.values(exampleKinds).sort())
  })

  it('should match the modeled users', async () => {
    const all = (await app.get(UserRepository).getAll())._unsafeUnwrap()
    expect(all.sort(byId)).toEqual(Object.values(users).sort(byId))
  })

  it('should match the modeled teams', async () => {
    const all = (await app.get(TeamRepository).getAll())._unsafeUnwrap()
    expect(all.sort(byId)).toEqual(Object.values(teams).sort(byId))
  })
})
