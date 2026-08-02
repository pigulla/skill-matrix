import { HttpStatus, type INestApplication } from '@nestjs/common'
import { TerminusModule } from '@nestjs/terminus'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeEach, describe, it } from 'vitest'

import { HealthController } from '#/presentation/http/health/health.controller.js'

describe('HealthController', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      imports: [TerminusModule],
      controllers: [HealthController],
    }).compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(() => app.close())

  describe('GET /health', () => {
    it('should return 200 OK with status ok and no indicators', () =>
      request(app.getHttpServer())
        .get('/health')
        .expect(HttpStatus.OK)
        .expect({ status: 'ok', info: {}, error: {}, details: {} }))
  })
})
