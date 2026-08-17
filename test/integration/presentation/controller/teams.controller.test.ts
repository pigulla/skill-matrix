import { HttpStatus } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { TeamModule } from '#/module/team.module.js'
import { TeamsController } from '#/presentation/http/team/teams.controller.js'

import { TeamBuilder } from '../../../builder/team.builder.js'
import { UNKNOWN_TEAM_ID } from '../../../util/entity-ids.js'
import { byId } from '../../../util/sort-by-id.js'
import { teams } from '../../fixture/fixture.js'
import { type ETags, getETags, STALE_ETAG } from '../../fixture/get-etags.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

const ETAG_PATTERN = /^W\/".+"$/

describe('TeamsController', () => {
  const integrationTest = setupIntegrationTest()

  let app: NestExpressApplication
  let etags: ETags

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

    app = await module
      .createNestApplication<NestExpressApplication>({ logger: false })
      .enableShutdownHooks()
      .init()
    app.disable('etag')
    etags = await getETags(app.get(IConnectionProvider).database)
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
            .map(team => team.toJSON()),
        ))
  })

  describe('GET /teams/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.traffic.id}`)
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(teams.traffic.toJSON()))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer()).get(`/teams/${UNKNOWN_TEAM_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /teams/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.testing.id}`)
        .set('If-Match', etags.teams[teams.testing.id].etag)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .delete(`/teams/${UNKNOWN_TEAM_ID}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.testing.id}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.testing.id}`)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })

  describe('POST /teams', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: 'DevOps',
        })
        .expect(HttpStatus.CREATED)
        .expect('etag', ETAG_PATTERN)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'DevOps',
          }),
        ))

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: 42,
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({ name: 'DevOps', extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .post('/teams')
        .send({
          name: teams.testing.name,
        })
        .expect(HttpStatus.CONFLICT))
  })

  describe('PUT /teams/:id', () => {
    const expected = TeamBuilder.from(teams.testing).withName('QA').build()

    it('should return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .set('If-Match', etags.teams[teams.testing.id].etag)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(expected.toJSON())

      expect(response.headers.etag).not.toEqual(etags.teams[teams.testing.id].etag)
    })

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .set('If-Match', etags.teams[teams.testing.id].etag)
        .send({ ...expected.toJSON(), name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .set('If-Match', etags.teams[teams.testing.id].etag)
        .send({ ...expected.toJSON(), id: teams.traffic.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .set('If-Match', etags.teams[teams.testing.id].etag)
        .send({ ...expected.toJSON(), extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .put(`/teams/${UNKNOWN_TEAM_ID}`)
        .set('If-Match', STALE_ETAG)
        .send({ ...expected.toJSON(), id: UNKNOWN_TEAM_ID })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .set('If-Match', STALE_ETAG)
        .send(expected.toJSON())
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.testing.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })
})
