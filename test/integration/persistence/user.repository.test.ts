import type { INestApplication } from '@nestjs/common'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import { User } from '#/domain/user/user.js'
import { asUserID } from '#/domain/user/user-id.js'
import { UserRepository } from '#/infrastructure/persistence/user/user.repository.js'

import { UserBuilder } from '../../builder/user.builder.js'
import {
  ENTITY_ASSERTION_HELPER,
  type EntityAssertionHelper,
} from '../fixture/entity-assertion-helper.js'
import { teams, users } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('UserRepository', () => {
  const invalidId = asUserID('00000000-0001-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication
  let userRepository: UserRepository
  let entity: EntityAssertionHelper

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: UserRepository.name,
        providers: [UserRepository],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    userRepository = app.get(UserRepository)
    entity = app.get(ENTITY_ASSERTION_HELPER)
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a user', async () => {
      await expect(userRepository.get(users.dale.id)).resolves.toEqual(users.dale)
    })

    it('should throw', async () => {
      await expect(userRepository.get(invalidId)).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('getAll', () => {
    it('should return all users', async () => {
      await expect(userRepository.getAll()).resolves.to.have.deep.members(Object.values(users))
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updatedUser = UserBuilder.from(users.dale)
        .withFirstName('Dale-Bob')
        .withEmail('dale-bob.glass@example.com')
        .build()

      await expect(userRepository.update(updatedUser)).resolves.toEqual(updatedUser)

      await entity(User)
        .withId(users.dale.id)
        .andColumns({
          first_name: 'Dale-Bob',
          last_name: 'Glass',
          email: 'dale-bob.glass@example.com',
          team_id: users.dale.teamId,
        })
        .should.exist()
    })

    it('should throw if the user does not exist', async () => {
      const nonexistentUser = new UserBuilder().withId(invalidId).build()
      await expect(() => userRepository.update(nonexistentUser)).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('delete', () => {
    it('should delete a user', async () => {
      await expect(userRepository.delete(users.dale.id)).resolves.toBeUndefined()

      await entity(User).withId(users.dale.id).should.not.exist()
    })

    it('should throw if the user does not exist', async () => {
      await expect(() => userRepository.delete(invalidId)).rejects.toThrow(UserNotFoundError)
    })
  })

  describe('create', () => {
    it('should create a user', async () => {
      const user = new UserBuilder()
        .with({
          id: '12345678-0001-4000-8000-000000000000',
          firstName: 'Bob',
          lastName: 'Farrell',
          email: 'bob.farrell@example.com',
          teamId: teams.platform.id,
        })
        .build()

      await expect(userRepository.create(user)).resolves.toEqual(user)
      await entity(User)
        .withId(user.id)
        .andColumns({
          first_name: user.firstName,
          last_name: user.lastName,
          email: user.email,
          team_id: user.teamId,
        })
        .should.exist()
    })

    it('should throw if the id already exists', async () => {
      await expect(userRepository.create(users.eddie)).rejects.toThrow(DuplicateUserIdError)
    })

    it('should throw if the team does not exist', async () => {
      const user = new UserBuilder()
        .with({
          id: '12345678-0001-4000-8000-000000000001',
          firstName: 'Bob',
          lastName: 'Farrell',
          email: 'bob.farrell@example.com',
          teamId: '99999999-0002-4000-8000-000000000000',
        })
        .build()

      await expect(userRepository.create(user)).rejects.toThrow(TeamReferenceNotFoundError)
      await entity(User).withId(user.id).should.not.exist()
    })
  })

  describe('assignTeam', () => {
    it('should move a user to another team', async () => {
      const result = await userRepository.assignTeam(users.dale.id, teams.platform.id)

      expect(result.teamId).toBe(teams.platform.id)

      await entity(User)
        .withId(users.dale.id)
        .andColumns({
          team_id: teams.platform.id,
        })
        .should.exist()
    })

    it('should throw if the user does not exist', async () => {
      await expect(() => userRepository.assignTeam(invalidId, teams.platform.id)).rejects.toThrow(
        UserNotFoundError,
      )
    })

    it('should throw if the team does not exist', async () => {
      await expect(() =>
        userRepository.assignTeam(users.dale.id, asTeamID('99999999-0002-4000-8000-000000000000')),
      ).rejects.toThrow(TeamReferenceNotFoundError)
    })
  })
})
