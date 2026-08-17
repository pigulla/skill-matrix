import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { UserModule } from '#/module/user.module.js'
import { UsersController } from '#/presentation/http/user/users.controller.js'

import { UserBuilder } from '../../../builder/user.builder.js'
import { UNKNOWN_TEAM_ID, UNKNOWN_USER_ID } from '../../../util/entity-ids.js'
import { byId } from '../../../util/sort-by-id.js'
import { teams, users } from '../../fixture/fixture.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

describe('UsersController', () => {
  const integrationTest = setupIntegrationTest()

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
    await app?.close()
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
            .map(user => user.toJSON()),
        ))
  })

  describe('GET /users/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/users/${users.peter.id}`)
        .expect(HttpStatus.OK)
        .expect(users.peter.toJSON()))

    it('should return 404 Not Found if the user does not exist', () =>
      request(app.getHttpServer()).get(`/users/${UNKNOWN_USER_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /users/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer()).delete(`/users/${users.peter.id}`).expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found if the user does not exist', () =>
      request(app.getHttpServer()).delete(`/users/${UNKNOWN_USER_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /users', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy@potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.testing.id,
        })
        .expect(HttpStatus.CREATED)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            email: 'hairy@potter.com',
            firstName: 'Hairy',
            lastName: 'Potter',
            teamId: teams.testing.id,
          }),
        ))

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy.potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.testing.id,
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy@potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.testing.id,
          extraneous: 'nope',
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the email is not unique', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: users.peter.email,
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: teams.testing.id,
        })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if the referenced team does not exist', () =>
      request(app.getHttpServer())
        .post('/users')
        .send({
          email: 'hairy@potter.com',
          firstName: 'Hairy',
          lastName: 'Potter',
          teamId: UNKNOWN_TEAM_ID,
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /users/:id', () => {
    const body = UserBuilder.from(users.peter)
      .withLastName('Spaghetti')
      .withTeamId(teams.testing.id)
      .build()
      .toJSON()

    it('should return 200 OK', async () => {
      await request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send(body)
        .expect(HttpStatus.OK)
        .expect(body)
    })

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send({ ...body, firstName: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send({ ...body, id: users.clemens.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send({ ...body, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the user does not exist', () =>
      request(app.getHttpServer())
        .put(`/users/${UNKNOWN_USER_ID}`)
        .send({ ...body, id: UNKNOWN_USER_ID })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the email is not unique', () =>
      request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send({
          ...body,
          email: users.cherie.email,
        })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if the referenced team does not exist', () =>
      request(app.getHttpServer())
        .put(`/users/${body.id}`)
        .send({ ...body, teamId: UNKNOWN_TEAM_ID })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })
})
