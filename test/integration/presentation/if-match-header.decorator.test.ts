import { createHash } from 'node:crypto'

import { Controller, HttpStatus, type INestApplication, Put } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { asConcurrencyToken, type ConcurrencyToken } from '#/domain/concurrency-token.js'
import { toETag } from '#/presentation/http/etag.js'
import { IfMatchHeader } from '#/presentation/http/if-match-header.decorator.js'

import { STALE_CONCURRENCY_TOKEN } from '../../util/concurrency-tokens.js'

@Controller('test')
class IfMatchHeaderTestController {
  @Put()
  public put(@IfMatchHeader() token: ConcurrencyToken): { token: ConcurrencyToken } {
    return { token }
  }
}

describe('IfMatchHeader', () => {
  let app: INestApplication

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      controllers: [IfMatchHeaderTestController],
    }).compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(() => app.close())

  it('should accept a well-formed weak entity tag and pass the parsed token through', () =>
    request(app.getHttpServer())
      .put('/test')
      .set('If-Match', toETag(STALE_CONCURRENCY_TOKEN))
      .expect(HttpStatus.OK)
      .expect({ token: STALE_CONCURRENCY_TOKEN }))

  it('should return 400 Bad Request if the If-Match header token is not a valid hash', () =>
    request(app.getHttpServer())
      .put('/test')
      .set('If-Match', 'W/"not-a-valid-hash"')
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/malformed/i)
      }))

  it('should return 400 Bad Request if the If-Match header is malformed', () =>
    request(app.getHttpServer())
      .put('/test')
      .set('If-Match', 'malformed')
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/malformed/i)
      }))

  it('should return 400 Bad Request with a weak-entity-tag message if the If-Match header is a strong entity tag', () =>
    request(app.getHttpServer())
      .put('/test')
      .set('If-Match', `"${'a'.repeat(32)}"`)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/weak entity tag/i)
      }))

  it('should return 400 Bad Request if the If-Match header token is not a valid hex-encoded hash', () => {
    // A genuine MD5 hash with its last character replaced by 'g' — the right shape, one invalid hex digit.
    const validToken = asConcurrencyToken(createHash('md5').update('example').digest('hex'))
    const tokenWithInvalidCharacter = `${validToken.slice(0, -1)}g`

    return request(app.getHttpServer())
      .put('/test')
      .set('If-Match', `W/"${tokenWithInvalidCharacter}"`)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/malformed/i)
      })
  })

  it('should return 400 Bad Request if the If-Match header token has the wrong length', () =>
    request(app.getHttpServer())
      .put('/test')
      .set('If-Match', `W/"${'a'.repeat(31)}"`)
      .expect(HttpStatus.BAD_REQUEST)
      .expect(({ body }) => {
        expect(body.errors[0].message).toMatch(/malformed/i)
      }))
})
