import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { asExampleID } from '#/domain/example/example-id.js'
import { asSkillID } from '#/domain/skill/skill-id.js'
import { SkillModule } from '#/module/skill.module.js'
import { SkillsController } from '#/presentation/http/skill/skills.controller.js'

import { SkillBuilder } from '../../builder/skill.builder.js'
import { byId } from '../../util/sort-by-id.js'
import { examples, skills } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('SkillsController', () => {
  const unknownSkillId = asSkillID('00000000-0003-4000-8000-000000000000')
  const unknownExampleId = asExampleID('00000000-0004-4000-8000-000000000000')
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

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

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
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
        .expect(skills.backendDevelopment.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).get(`/skills/${unknownSkillId}`).expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /skills/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.qualityAssurance.id}`)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer()).delete(`/skills/${unknownSkillId}`).expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict', () =>
      request(app.getHttpServer())
        .delete(`/skills/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.CONFLICT))
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
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'Legacy',
            description: `Things we don't need anymore`,
            exampleIds: [examples.cobol.id, examples.solid.id].sort(),
          }),
        ))

    it('should return 400 Bad Request if a property is malformed', () =>
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

    it('should return 422 Unprocessable Entity if the example does not exist', () =>
      request(app.getHttpServer())
        .post('/skills')
        .send({
          name: 'Legacy',
          description: `Things we don't need anymore`,
          exampleIds: [examples.cobol.id, unknownExampleId],
        })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /skills/:id', () => {
    it('should return 200 OK', async () => {
      const expected = SkillBuilder.from(skills.backendDevelopment)
        .withExamples([examples.cobol.id])
        .build()

      await request(app.getHttpServer())
        .put(`/skills/${skills.backendDevelopment.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect(expected.toJSON())
    })

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .put(`/skills/${skills.backendDevelopment.id}`)
        .send({ ...skills.backendDevelopment.toJSON(), name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/skills/${skills.backendDevelopment.id}`)
        .send({ ...skills.backendDevelopment.toJSON(), id: skills.frontendDevelopment.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/skills/${skills.backendDevelopment.id}`)
        .send({ ...skills.backendDevelopment.toJSON(), extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/skills/${unknownSkillId}`)
        .send({ ...skills.backendDevelopment.toJSON(), id: unknownSkillId })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .put(`/skills/${skills.backendDevelopment.id}`)
        .send({ ...skills.backendDevelopment.toJSON(), name: skills.frontendDevelopment.name })
        .expect(HttpStatus.CONFLICT))
  })
})
