import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { ExampleModule } from '#/module/example.module.js'
import { ExampleKindsController } from '#/presentation/http/example/kind/example-kinds.controller.js'

import { ExampleKindBuilder } from '../../builder/example-kind.builder.js'
import { UNKNOWN_EXAMPLE_KIND_ID } from '../../util/entity-ids.js'
import { byId } from '../../util/sort-by-id.js'
import { exampleKinds } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('ExampleKindsController', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

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

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
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
        .expect(exampleKinds.technology.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .get(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /examples/kinds/:id', () => {
    it('should return 204 No Content', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.concept.id}`)
        .expect(HttpStatus.NO_CONTENT))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .get(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 409 Conflict if the example kind is still referenced by an example', () =>
      request(app.getHttpServer())
        .delete(`/examples/kinds/${exampleKinds.technology.id}`)
        .expect(HttpStatus.CONFLICT))
  })

  describe('POST /examples/kinds', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: 'Tool' })
        .expect(HttpStatus.CREATED)
        .then(({ body }) =>
          expect(body).toEqual({
            id: expect.any(String),
            name: 'Tool',
          }),
        ))

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .post('/examples/kinds')
        .send({ name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the name is taken', () =>
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
      await request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .send(expected.toJSON())
        .expect(HttpStatus.OK)
        .expect(expected.toJSON())
    })

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .send({ ...expected.toJSON(), name: 42 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the ids do not match', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .send({ ...expected.toJSON(), id: exampleKinds.pattern.id })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${exampleKinds.concept.id}`)
        .send({ ...expected.toJSON(), extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .put(`/examples/kinds/${UNKNOWN_EXAMPLE_KIND_ID}`)
        .send({ ...expected.toJSON(), id: UNKNOWN_EXAMPLE_KIND_ID })
        .expect(HttpStatus.NOT_FOUND))
  })
})
