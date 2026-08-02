import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { asTeamID } from '#/domain/team/team-id.js'
import { asUserID } from '#/domain/user/user-id.js'
import { UserModule } from '#/module/user.module.js'
import { UsersController } from '#/presentation/http/user/users.controller.js'

import { UserBuilder } from '../../builder/user.builder.js'
import { byId } from '../../util/sort-by-id.js'
import { teams, users } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('UsersController', () => {
  const unknownUserId = asUserID('00000000-0001-4000-8000-000000000000')
  const unknownTeamId = asTeamID('00000000-0002-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: UsersController.name,
        imports: [UserModule],
      })
      .compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app.close()
    await integrationTest.afterEach()
  })

  describe('GET /users', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get('/users')
        .expect(HttpStatus.OK)
        .expect(
          Object.values(users)
            .sort(byId)
            .map(example => example.toJSON()),
        ))
  })

  describe('GET /user/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/users/${users.eddie.id}`)
        .expect(HttpStatus.OK)
        .expect(users.eddie.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).get(`/users/${unknownUserId}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /users/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer()).delete(`/users/${users.eddie.id}`).expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).get(`/users/${unknownUserId}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /users', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy@potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.qa.id,
        })
        .expect(HttpStatus.CREATED)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            email: 'hairy@potter.com',
            firstName: 'Hairy',
            lastName: 'Potter',
            teamId: teams.qa.id,
          }),
        ))

    it('should return 400 Bad Request', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy.potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.qa.id,
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the email is taken', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: users.eddie.email,
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.qa.id,
        })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if the team does not exist', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy@potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: asTeamID('00000000-0002-4000-8000-000000000000'),
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /users/:id', () => {
    const expected = UserBuilder.from(users.eddie).withLastName('Spaghetti').build()
    const { teamId, ...rest } = expected.toJSON()

    it('should return 200 OK', async () => {
      await request(app.getHttpServer())
        .put(`/users/${users.eddie.id}`)
        .send(rest)
        .expect(HttpStatus.OK)
        .expect(expected.toJSON())
    })

    it('should return 400 Bad Request if the payload is invalid', () =>
      request(app.getHttpServer())
        .put(`/users/${users.eddie.id}`)
        .send({ ...rest, firstName: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/users/${users.eddie.id}`)
        .send({ ...rest, id: users.dale.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/users/${unknownUserId}`)
        .send({ ...rest, id: unknownUserId })
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('PUT /users/:id/team', () => {
    it('should return 200 OK', async () => {
      await request(app.getHttpServer())
        .put(`/users/${users.eddie.id}/team`)
        .send({ teamId: teams.qa.id })
        .expect(HttpStatus.OK)
        .expect(UserBuilder.from(users.eddie).withTeamId(teams.qa.id).build().toJSON())
    })

    it('should return 400 Bad Request if the payload is invalid', () =>
      request(app.getHttpServer())
        .put(`/users/${users.eddie.id}/team`)
        .send({ teamId: 'Banana' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/users/${unknownUserId}/team`)
        .send({ teamId: teams.qa.id })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 422 Unprocessable Entity if the team does not exist', () =>
      request(app.getHttpServer())
        .put(`/users/${users.eddie.id}/team`)
        .send({ teamId: unknownTeamId })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })
})
