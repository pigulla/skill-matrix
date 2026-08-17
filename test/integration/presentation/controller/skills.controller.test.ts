import { HttpStatus } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { SkillModule } from '#/module/skill.module.js'
import { SkillsController } from '#/presentation/http/skill/skills.controller.js'

import { SkillBuilder } from '../../../builder/skill.builder.js'
import { UNKNOWN_EXAMPLE_ID, UNKNOWN_SKILL_ID } from '../../../util/entity-ids.js'
import { byId } from '../../../util/sort-by-id.js'
import { examples, skills } from '../../fixture/fixture.js'
import { type ETags, getETags, STALE_ETAG } from '../../fixture/get-etags.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

const ETAG_PATTERN = /^W\/".+"$/

describe('SkillsController', () => {
  const integrationTest = setupIntegrationTest()

  let app: NestExpressApplication
  let etags: ETags

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: SkillsController.name,
        imports: [SkillModule],
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

  describe('GET /skills', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get('/skills')
        .expect(HttpStatus.OK)
        .expect(
          Object.values(skills)
            .sort(byId)
            .map(skill => skill.toJSON()),
        ))
  })

  describe('GET /skills/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/skills/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(skills.backendDevelopment.toJSON()))

    it('should return 404 Not Found if the skill does not exist', () =>
      request(app.getHttpServer()).get(`/skills/${UNKNOWN_SKILL_ID}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /skills/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.qualityAssurance.id}`)
        .set('If-Match', etags.skills[skills.qualityAssurance.id].etag)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found if the skill does not exist', () =>
      request(app.getHttpServer())
        .delete(`/skills/${UNKNOWN_SKILL_ID}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the skill is still referenced by a team', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.backendDevelopment.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .expect(HttpStatus.CONFLICT))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.qualityAssurance.id}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.qualityAssurance.id}`)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })

  describe('POST /skills', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'Legacy',
          description: `Things we don't need anymore`,
          exampleIds: [examples.cobol.id, examples.solid.id],
        })
        .expect(HttpStatus.CREATED)
        .expect('etag', ETAG_PATTERN)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'Legacy',
            description: `Things we don't need anymore`,
            exampleIds: [examples.cobol.id, examples.solid.id].sort(),
          }),
        ))

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'Legacy',
          description: `Things we don't need anymore`,
          exampleIds: 42,
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'Legacy',
          description: `Things we don't need anymore`,
          exampleIds: [examples.cobol.id, examples.solid.id],
          extraneous: 'nope',
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: skills.softwareArchitecture.name,
          description: 'Even more architecture',
          exampleIds: [],
        })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if a referenced example does not exist', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'Legacy',
          description: `Things we don't need anymore`,
          exampleIds: [examples.cobol.id, UNKNOWN_EXAMPLE_ID],
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /skills/:id', () => {
    const body = SkillBuilder.from(skills.backendDevelopment)
      .withExamples([examples.cobol.id])
      .build()
      .toJSON()

    it('should return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send(body)
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(body)

      expect(response.headers.etag).not.toEqual(etags.skills[skills.backendDevelopment.id].etag)
    })

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send({ ...body, name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send({ ...body, id: skills.frontendDevelopment.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send({ ...body, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the skill does not exist', () =>
      request(app.getHttpServer())
        .put(`/skills/${UNKNOWN_SKILL_ID}`)
        .set('If-Match', STALE_ETAG)
        .send({ ...body, id: UNKNOWN_SKILL_ID })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send({ ...body, name: skills.frontendDevelopment.name })
        .expect(HttpStatus.CONFLICT))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', STALE_ETAG)
        .send(body)
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 422 Unprocessable Entity if a referenced example does not exist', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .set('If-Match', etags.skills[skills.backendDevelopment.id].etag)
        .send({ ...body, exampleIds: [examples.html.id, UNKNOWN_EXAMPLE_ID] })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .put(`/skills/${body.id}`)
        .send(body)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })
})
