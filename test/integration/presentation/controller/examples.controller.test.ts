import { HttpStatus } from '@nestjs/common'
import type { NestExpressApplication } from '@nestjs/platform-express'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ExampleModule } from '#/module/example.module.js'
import { ExamplesController } from '#/presentation/http/example/examples.controller.js'

import { ExampleBuilder } from '../../../builder/example.builder.js'
import { UNKNOWN_EXAMPLE_ID, UNKNOWN_EXAMPLE_KIND_ID } from '../../../util/entity-ids.js'
import { byId } from '../../../util/sort-by-id.js'
import { exampleKinds, examples } from '../../fixture/fixture.js'
import { type ETags, getETags, STALE_ETAG } from '../../fixture/get-etags.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

const ETAG_PATTERN = /^W\/".+"$/

describe('ExamplesController', () => {
  const integrationTest = setupIntegrationTest()

  let app: NestExpressApplication
  let etags: ETags

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
        .expect('etag', ETAG_PATTERN)
        .expect(examples.react.toJSON()))

    it('should return 404 Not Found if the example does not exist', () =>
      request(app.getHttpServer())
        .get(`/examples/${UNKNOWN_EXAMPLE_ID}`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /examples/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/examples/${examples.cobol.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found if the example does not exist', () =>
      request(app.getHttpServer())
        .delete(`/examples/${UNKNOWN_EXAMPLE_ID}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the example is still referenced by a skill', () =>
      request(app.getHttpServer())
        .delete(`/examples/${examples.nestjs.id}`)
        .set('If-Match', etags.examples[examples.nestjs.id].etag)
        .expect(HttpStatus.CONFLICT))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .delete(`/examples/${examples.cobol.id}`)
        .set('If-Match', STALE_ETAG)
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .delete(`/examples/${examples.cobol.id}`)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })

  describe('POST /examples', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 'TypeScript', exampleKindId: exampleKinds.technology.id, url: null })
        .expect(HttpStatus.CREATED)
        .expect('etag', ETAG_PATTERN)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'TypeScript',
            exampleKindId: exampleKinds.technology.id,
            url: null,
          }),
        ))

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 42, exampleKindId: exampleKinds.technology.id, url: null })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({
          name: 'TypeScript',
          exampleKindId: exampleKinds.technology.id,
          url: null,
          extraneous: 'nope',
        })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: examples.cobol.name, exampleKindId: exampleKinds.technology.id, url: null })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if a referenced example kind does not exist', () =>
      request(app.getHttpServer())
        .post('/examples')
        .send({ name: 'TypeScript', exampleKindId: UNKNOWN_EXAMPLE_KIND_ID, url: null })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /examples/:id', () => {
    const body = ExampleBuilder.from(examples.cobol).withName('C0B01').build().toJSON()

    it('should return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send(body)
        .expect(HttpStatus.OK)
        .expect('etag', ETAG_PATTERN)
        .expect(body)

      expect(response.headers.etag).not.toEqual(etags.examples[examples.cobol.id].etag)
    })

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send({ ...body, url: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send({ ...body, id: examples.react.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should treat an upper-cased id in the route as the same id as in the payload', () => {
      // The route id and the payload id are the same UUID in different cases. Only the payload id is
      // normalized by its schema, so an un-normalized route id makes the handler's id comparison
      // reject a request that is perfectly well-formed.
      const upperCased = ExampleBuilder.from(examples.infrastructureAsCode)
        .withName('IaC')
        .build()
        .toJSON()

      return request(app.getHttpServer())
        .put(`/examples/${(upperCased.id as string).toUpperCase()}`)
        .set('If-Match', etags.examples[examples.infrastructureAsCode.id].etag)
        .send(upperCased)
        .expect(HttpStatus.OK)
        .expect(upperCased)
    })

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send({ ...body, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the example does not exist', () =>
      request(app.getHttpServer())
        .put(`/examples/${UNKNOWN_EXAMPLE_ID}`)
        .set('If-Match', STALE_ETAG)
        .send(ExampleBuilder.from(examples.cobol).withId(UNKNOWN_EXAMPLE_ID).build().toJSON())
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the name is not unique', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send({ ...body, name: examples.react.name })
        .expect(HttpStatus.CONFLICT))

    it('should return 412 Precondition Failed if the If-Match header is stale', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', STALE_ETAG)
        .send(examples.cobol.toJSON())
        .expect(HttpStatus.PRECONDITION_FAILED))

    it('should return 422 Unprocessable Entity if a referenced example kind does not exist', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .set('If-Match', etags.examples[examples.cobol.id].etag)
        .send({ ...body, exampleKindId: UNKNOWN_EXAMPLE_KIND_ID })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))

    it('should return 428 Precondition Required if the If-Match header is missing', () =>
      request(app.getHttpServer())
        .put(`/examples/${body.id}`)
        .send(body)
        .expect(HttpStatus.PRECONDITION_REQUIRED))
  })
})
