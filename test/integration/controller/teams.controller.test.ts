import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { TeamModule } from '#/module/team.module.js'
import { TeamsController } from '#/presentation/http/team/teams.controller.js'

import { TeamBuilder } from '../../builder/team.builder.js'
import { UNKNOWN_TEAM_ID } from '../../util/entity-ids.js'
import { byId } from '../../util/sort-by-id.js'
import { teams } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('TeamsController', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: TeamsController.name,
        imports: [TeamModule],
      })
      .compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('GET /teams', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get('/teams')
        .expect(HttpStatus.OK)
        .expect(
          Object.values(teams)
            .sort(byId)
            .map(example => example.toJSON()),
        ))
  })

  describe('GET /teams/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.traffic.id}`)
        .expect(HttpStatus.OK)
        .expect(teams.traffic.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).get(`/teams/${UNKNOWN_TEAM_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /teams/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.testing.id}`)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).get(`/teams/${UNKNOWN_TEAM_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /teams', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: 'DevOps',
        })
        .expect(HttpStatus.CREATED)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'DevOps',
          }),
        ))

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: 42,
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is taken', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: teams.testing.name,
        })
        .expect(HttpStatus.CONFLICT))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'DevOps', extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))
  })

  describe('PUT /teams/:id', () => {
    const expected = TeamBuilder.from(teams.testing).withName('QA').build()

    it('should return 200 OK', async () => {
      await request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect(expected.toJSON())
    })

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .send({ ...expected.toJSON(), name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .send({ ...expected.toJSON(), id: teams.traffic.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .send({ ...expected.toJSON(), extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/teams/${UNKNOWN_TEAM_ID}`)
        .send({ ...expected.toJSON(), id: UNKNOWN_TEAM_ID })
        .expect(HttpStatus.NOT_FOUND))
  })
})
