import type { INestApplication } from '@nestjs/common'
import type { Ok } from 'neverthrow'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ExampleRepository } from '#/infrastructure/persistence/example/example.repository.js'
import { ExampleKindRepository } from '#/infrastructure/persistence/example/kind/example-kind.repository.js'
import { SkillRepository } from '#/infrastructure/persistence/skill/skill.repository.js'
import { TeamRepository } from '#/infrastructure/persistence/team/team.repository.js'
import { UserRepository } from '#/infrastructure/persistence/user/user.repository.js'
import { UtilityModule } from '#/module/utility.module.js'

import { exampleKinds, examples, skills, teams, users } from './fixture.js'
import { setupIntegrationTest } from './setup-integration-test.js'

describe.concurrent('Data in the SQL fixture', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

  beforeAll(async () => {
    await integrationTest.beforeAll()
    await integrationTest.beforeEach()
    const module = await integrationTest
      .createModule({
        testName: 'fixtureData',
        imports: [UtilityModule],
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

  afterAll(async () => {
    await app?.close()

    await integrationTest.afterEach()
    await integrationTest.afterAll()
  })

  it('should match the modeled examples', async () => {
    const all = await app.get(ExampleRepository).getAll()

    expect(all.isOk()).toBe(true)
    expect((all as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(examples))
  })

  it('should match the modeled skills', async () => {
    const all = await app.get(SkillRepository).getAll()

    expect(all.isOk()).toBe(true)
    expect((all as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(skills))
  })

  it('should match the modeled example kinds', async () => {
    const all = await app.get(ExampleKindRepository).getAll()

    expect(all.isOk()).toBe(true)
    expect((all as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(exampleKinds))
  })

  it('should match the modeled users', async () => {
    const all = await app.get(UserRepository).getAll()

    expect(all.isOk()).toBe(true)
    expect((all as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(users))
  })

  it('should match the modeled teams', async () => {
    const all = await app.get(TeamRepository).getAll()

    expect(all.isOk()).toBe(true)
    expect((all as Ok<unknown, unknown>).value).to.have.deep.members(Object.values(teams))
  })
})
