import type { INestApplication } from '@nestjs/common'
import type { Database } from '@nestjs-cls/transactional-adapter-pg-promise'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { DuplicateUserEmailError } from '#/domain/user/error/duplicate-user-email.error.js'
import { DuplicateUserIdError } from '#/domain/user/error/duplicate-user-id.error.js'
import { UserNotFoundError } from '#/domain/user/error/user-not-found.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { UserRepository } from '#/infrastructure/persistence/user/user.repository.js'

import { UserBuilder } from '../../builder/user.builder.js'
import { UNKNOWN_TEAM_ID, UNKNOWN_USER_ID } from '../../util/entity-ids.js'
import { teams, users } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('UserRepository', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let userRepository: UserRepository
  let db: Database

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
    db = app.get(IConnectionProvider).database
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('get', () => {
    it('should return a user', async () => {
      const result = await userRepository.get(users.clemens.id)

      expect(result._unsafeUnwrap()).toEqual(users.clemens)
    })

    it('should return UserNotFoundError', async () => {
      const result = await userRepository.get(UNKNOWN_USER_ID)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(UserNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE users RENAME TO users_renamed')

      await expect(userRepository.get(users.clemens.id)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('getAll', () => {
    it('should return all users', async () => {
      const result = await userRepository.getAll()

      expect(result._unsafeUnwrap()).to.have.deep.members(Object.values(users))
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE users RENAME TO users_renamed')

      await expect(userRepository.getAll()).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('update', () => {
    it('should update a user', async () => {
      const updated = UserBuilder.from(users.clemens)
        .withFirstName('Clemens-Bob')
        .withEmail('clemens-bob.cook@example.com')
        .withTeamId(teams.traffic.id)
        .build()

      const result = await userRepository.update(updated)

      expect(result._unsafeUnwrap()).toEqual(updated)

      await expect(
        db.oneOrNone('SELECT * FROM users WHERE id=$(id)', { id: updated.id }),
      ).resolves.toMatchObject({
        first_name: updated.firstName,
        last_name: updated.lastName,
        email: updated.email,
        team_id: updated.teamId,
      })
    })

    it('should return UserNotFoundError if the user does not exist', async () => {
      const nonexistentUser = UserBuilder.create()

      const result = await userRepository.update(nonexistentUser)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(UserNotFoundError)
    })

    it('should return TeamReferenceNotFoundError if the team does not exist', async () => {
      const updated = UserBuilder.from(users.clemens)
        .withTeamId('99999999-0002-4000-8000-000000000000')
        .build()

      const result = await userRepository.update(updated)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamReferenceNotFoundError)
    })

    it('should return DuplicateUserEmailError if the email already exists', async () => {
      const updated = users.clemens.update({ email: users.peter.email })

      const result = await userRepository.update(updated)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateUserEmailError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const updated = UserBuilder.from(users.clemens).withFirstName('Clemens-Bob').build()

      await db.none('ALTER TABLE users RENAME TO users_renamed')

      await expect(userRepository.update(updated)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })

  describe('delete', () => {
    it('should delete a user', async () => {
      const result = await userRepository.delete(users.clemens.id)

      expect(result._unsafeUnwrap()).toBeUndefined()

      await expect(
        db.oneOrNone('SELECT * FROM users WHERE id=$(id)', { id: users.clemens.id }),
      ).resolves.toBeNull()
    })

    it('should return UserNotFoundError if the user does not exist', async () => {
      const result = await userRepository.delete(UNKNOWN_USER_ID)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(UserNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      await db.none('ALTER TABLE users RENAME TO users_renamed')

      await expect(userRepository.delete(users.clemens.id)).rejects.toThrow(
        UnexpectedPersistenceError,
      )
    })
  })

  describe('create', () => {
    it('should create a user', async () => {
      const created = new UserBuilder()
        .with({
          firstName: 'Bob',
          lastName: 'Farrell',
          email: 'bob.farrell@example.com',
          teamId: teams.traffic.id,
        })
        .build()

      const result = await userRepository.create(created)

      expect(result._unsafeUnwrap()).toEqual(created)

      await expect(
        db.oneOrNone('SELECT * FROM users WHERE id=$(id)', { id: created.id }),
      ).resolves.toMatchObject({
        id: created.id,
        first_name: created.firstName,
        last_name: created.lastName,
        email: created.email,
        team_id: created.teamId,
      })
    })

    it('should return DuplicateUserIdError if the id already exists', async () => {
      const result = await userRepository.create(users.peter)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(DuplicateUserIdError)
    })

    it('should return TeamReferenceNotFoundError if the team does not exist', async () => {
      const user = new UserBuilder().withTeamId(UNKNOWN_TEAM_ID).build()

      const result = await userRepository.create(user)

      expect(result._unsafeUnwrapErr()).toBeInstanceOf(TeamReferenceNotFoundError)
    })

    it('should throw UnexpectedPersistenceError when the query fails', async () => {
      const user = UserBuilder.create()

      await db.none('ALTER TABLE users RENAME TO users_renamed')

      await expect(userRepository.create(user)).rejects.toThrow(UnexpectedPersistenceError)
    })
  })
})
