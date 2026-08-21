import { Controller, Get, HttpStatus, type INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asSkillID, type SkillID, skillIdSchema } from '#/domain/skill/skill-id.js'
import { IdParam } from '#/presentation/http/id-param.decorator.js'

@Controller('test')
class IdParamTestController {
  @Get(':id')
  public get(@IdParam('id', skillIdSchema) id: SkillID): { id: SkillID } {
    return { id }
  }
}

describe('IdParam', () => {
  // Deliberately full of hex letters: an id of digits only would make the normalization case vacuous.
  const ID = asSkillID('aaaaaaaa-0003-4000-8000-cccccccccccc')

  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [IdParamTestController],
    }).compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(() => app.close())

  it('should pass a well-formed id through', () =>
    request(app.getHttpServer()).get(`/test/${ID}`).expect(HttpStatus.OK).expect({ id: ID }))

  it('should normalize an upper-cased id to the schema’s canonical lowercase form', () =>
    request(app.getHttpServer())
      .get(`/test/${ID.toUpperCase()}`)
      .expect(HttpStatus.OK)
      .expect({ id: ID }))

  it('should return 400 Bad Request if the id is not a UUID', () =>
    request(app.getHttpServer())
      .get('/test/not-a-uuid')
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/uuid/i)
      }))

  it('should return 400 Bad Request if the id is a UUID of the wrong version', () =>
    request(app.getHttpServer())
      .get('/test/00000000-0000-1000-8000-000000000000')
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/uuid/i)
      }))
})
