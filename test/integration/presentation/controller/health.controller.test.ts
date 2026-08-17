import { HttpStatus, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeEach, describe, it } from 'vitest'

import { HealthModule } from '#/module/health.module.js'

describe('HealthController', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [HealthModule],
    }).compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(() => app.close())

  describe('GET /health', () => {
    it('should return 200 OK with status ok', () =>
      request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.OK)
        .expect({ status: 'ok', info: {}, error: {}, details: {} }))
  })
})
