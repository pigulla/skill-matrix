import {
  type CallHandler,
  type ExecutionContext,
  Injectable,
  type NestInterceptor,
} from '@nestjs/common'
import type { Response } from 'express'
import { map, type Observable } from 'rxjs'

import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'

import { toETag } from './etag.js'

@Injectable()
export class ETagInterceptor<T> implements NestInterceptor<WithConcurrencyToken<T>, T> {
  public intercept(
    context: ExecutionContext,
    next: CallHandler<WithConcurrencyToken<T>>,
  ): Observable<T> {
    const res = context.switchToHttp().getResponse<Response>()

    return next.handle().pipe(
      map(({ value, token }) => {
        res.setHeader('ETag', toETag(token))
        return value
      }),
    )
  }
}
