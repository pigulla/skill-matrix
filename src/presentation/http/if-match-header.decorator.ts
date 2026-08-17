import {
  createParamDecorator,
  type ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common'
import type { Request } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import z from 'zod'

import { type ConcurrencyToken, concurrencyTokenSchema } from '#/domain/concurrency-token.js'

const IF_MATCH_PATTERN = /^(?<weak>W\/)?"(?<token>.+)"$/

const ifMatchHeaderSchema = z.string().transform((value, ctx) => {
  const groups = IF_MATCH_PATTERN.exec(value)?.groups

  if (groups === undefined) {
    ctx.addIssue({ code: 'custom', message: 'Malformed If-Match header' })
    return z.NEVER
  }

  if (groups.weak === undefined) {
    ctx.addIssue({
      code: 'custom',
      message:
        'If-Match must be a weak entity tag (e.g. W/"..."); strong entity tags are not supported',
    })
    return z.NEVER
  }

  const result = concurrencyTokenSchema.safeParse(groups.token)

  if (!result.success) {
    ctx.addIssue({ code: 'custom', message: 'Malformed If-Match header' })
    return z.NEVER
  }

  return result.data
})

export const IfMatchHeader = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): ConcurrencyToken => {
    const header = ctx.switchToHttp().getRequest<Request>().headers['if-match']

    if (header === undefined) {
      throw new HttpException('If-Match header is required', HttpStatus.PRECONDITION_REQUIRED)
    }

    const result = ifMatchHeaderSchema.safeParse(header)

    if (!result.success) {
      throw new ZodValidationException(result.error)
    }

    return result.data
  },
)
