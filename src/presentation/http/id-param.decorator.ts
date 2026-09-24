import { createParamDecorator, type ExecutionContext } from '@nestjs/common'
import type { Request } from 'express'
import { ZodValidationException } from 'nestjs-zod'
import type { ZodType } from 'zod'

/**
 * Binds a route parameter and validates it through the domain's own ID schema, so the branded type on the
 * handler parameter is produced by that schema rather than asserted over a bare string. `ParseUUIDPipe`
 * checks only UUID-ness and returns the raw string, which skips `idSchema`'s lowercase normalization — and
 * a route id that is not normalized while the payload id is compares unequal to it in the `PUT` handlers.
 *
 * A malformed id fails as a `ZodValidationException`, the same 400 path every other boundary-validation
 * failure takes (see `IfMatchHeader`).
 */
export function IdParam<T>(name: string, schema: ZodType<T>): ParameterDecorator {
  return createParamDecorator((_data: unknown, ctx: ExecutionContext): T => {
    const result = schema.safeParse(ctx.switchToHttp().getRequest<Request>().params[name])

    if (!result.success) {
      throw new ZodValidationException(result.error)
    }

    return result.data
  })()
}
