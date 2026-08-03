import { copyMethodMetadata } from 'nestjs-cls'
import type { Result } from 'neverthrow'

/**
 * Converts a method returning ResultAsync<T, E> into one NestJS can use directly
 * as an HTTP handler: Ok resolves to T as normal, Err throws E so the existing
 * exception filter maps it to the same HTTP status as a thrown error would.
 *
 * Uses copyMethodMetadata because NestJS route decorators (@Get(), @Post(), ...)
 * attach routing metadata to the method function itself, not the class prototype
 * — replacing descriptor.value without copying that metadata would silently break
 * routing depending on decorator stacking order.
 */
export function UnwrapResult(): MethodDecorator {
  return (_target, _propertyKey, descriptor) => {
    const original = descriptor.value as (
      ...args: unknown[]
    ) => PromiseLike<Result<unknown, unknown>>

    async function wrapped(this: unknown, ...args: unknown[]) {
      const result = await original.apply(this, args)

      if (result.isErr()) {
        throw result.error
      }

      return result.value
    }

    descriptor.value = wrapped as typeof descriptor.value

    copyMethodMetadata(original, descriptor.value)
  }
}
