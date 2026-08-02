import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { asExampleID } from '#/domain/example/example-id.js'
import { ExampleModule } from '#/module/example.module.js'
import { ExamplesController } from '#/presentation/http/example/examples.controller.js'

import { ExampleBuilder } from '../../builder/example.builder.js'
import { byId } from '../../util/sort-by-id.js'
import { exampleKinds, examples } from '../fixture/fixture.js'
import { setupDatabaseIntegrationTest } from '../fixture/setup-database-integration-test.js'

describe('ExamplesController', () => {
  const unknownExampleId = asExampleID('00000000-0004-4000-8000-000000000000')
  const integrationTest = setupDatabaseIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: ExamplesController.name,
        imports: [ExampleModule],
      })
      .compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app.close()
    await integrationTest.afterEach()
  })

  describe('GET /examples', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get('/examples')
        .expect(HttpStatus.OK)
        .expect(
          Object.values(examples)
            .sort(byId)
            .map(example => example.toJSON()),
        ))
  })

  describe('GET /examples/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/examples/${examples.react.id}`)
        .expect(HttpStatus.OK)
        .expect(examples.react.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .get(`/examples/${unknownExampleId}`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /examples/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/examples/${examples.cobol.id}`)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .get(`/examples/${unknownExampleId}`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /examples', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 'TypeScript', kind: exampleKinds.TECHNOLOGY, url: null })
        .expect(HttpStatus.CREATED)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'TypeScript',
            kind: exampleKinds.TECHNOLOGY,
            url: null,
          }),
        ))

    it('should return 400 Bad Request', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 42, kind: unknownExampleId, url: null })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 422 Unprocessable Entity if the kind does not exist', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 'TypeScript', kind: unknownExampleId, url: null })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /examples/:id', () => {
    it('should return 200 OK', async () => {
      const expected = ExampleBuilder.from(examples.cobol).withName('C0B01').build()

      await request(app.getHttpServer())
        .put(`/examples/${examples.cobol.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect(expected.toJSON())
    })

    it('should return 400 Bad Request for an invalid payload', () =>
      request(app.getHttpServer())
        .put(`/examples/${examples.cobol.id}`)
        .send({ ...examples.cobol.toJSON(), url: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/examples/${examples.cobol.id}`)
        .send({ ...examples.cobol.toJSON(), id: examples.react.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/examples/${unknownExampleId}`)
        .send(ExampleBuilder.from(examples.cobol).withId(unknownExampleId).build().toJSON())
        .expect(HttpStatus.NOT_FOUND))

    it('should return 422 Unprocessable Entity if the kind does not exist', () =>
      request(app.getHttpServer())
        .put(`/examples/${examples.cobol.id}`)
        .send({ ...examples.cobol.toJSON(), kind: 'Banana' })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })
})
