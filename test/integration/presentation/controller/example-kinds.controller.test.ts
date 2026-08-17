import { HttpStatus } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleModule } from '#/module/example.module.js'
import { ExampleKindsController } from '#/presentation/http/example/kind/example-kinds.controller.js'

import { ExampleKindBuilder } from '../../../builder/example-kind.builder.js'
import { UNKNOWN_EXAMPLE_KIND_ID } from '../../../util/entity-ids.js'
import { byId } from '../../../util/sort-by-id.js'
import { exampleKinds } from '../../fixture/fixture.js'
import { type ETags, getETags, STALE_ETAG } from '../../fixture/get-etags.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

const ETAG_PATTERN = /^W\/".+"$/

describe('ExampleKindsController', () => {
  const integrationTest = setupIntegrationTest()

  let app: NestExpressApplication
  let etags: ETags

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: ExampleKindsController.name,
        imports: [ExampleModule],
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

  describe('GET /examples/kinds', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get('/examples/kinds')
        .expect(HttpStatus.OK)
        .expect(
          Object.values(exampleKinds)
            .sort(byId)
            .map(exampleKind => exampleKind.toJSON()),
        ))
  })

  describe('GET /examples/kinds/:id', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/examples/kinds/${exampleKinds.technology.id}`)
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(exampleKinds.technology.toJSON()))

    it('should return 404 Not Found if the example kind does not exist', () =>
      request(app.getHttpServer())
        .get(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /examples/kinds/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.concept.id].etag)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found if the example kind does not exist', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the example kind is still referenced by an example', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.technology.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.technology.id].etag)
        .expect(HttpStatus.CONFLICT))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.concept.id}`)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })

  describe('POST /examples/kinds', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: 'Tool' })
        .expect(HttpStatus.CREATED)
        .expect('etag', ETAG_PATTERN)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'Tool',
          }),
        ))

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: exampleKinds.technology.name })
        .expect(HttpStatus.CONFLICT))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: 'Tool', extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))
  })

  describe('PUT /examples/kinds/:id', () => {
    const expected = ExampleKindBuilder.from(exampleKinds.concept).withName('Idea').build()

    it('should return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.concept.id].etag)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(expected.toJSON())

      expect(response.headers.etag).not.toEqual(etags.exampleKinds[exampleKinds.concept.id].etag)
    })

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.concept.id].etag)
        .send({ ...expected.toJSON(), name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.concept.id].etag)
        .send({ ...expected.toJSON(), id: exampleKinds.pattern.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', etags.exampleKinds[exampleKinds.concept.id].etag)
        .send({ ...expected.toJSON(), extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the example kind does not exist', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .set('If-Match', STALE_ETAG)
        .send({ ...expected.toJSON(), id: UNKNOWN_EXAMPLE_KIND_ID })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .set('If-Match', STALE_ETAG)
        .send(expected.toJSON())
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })
})
