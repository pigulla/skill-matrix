import { Module } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'

import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'

/**
 * The global HTTP enhancers, defined once for both the application and the integration-test harness.
 *
 * Nest applies APP_* providers globally regardless of which module declares them, so this does not
 * have to be the root module. Any new global pipe/filter/interceptor/guard belongs here — putting one
 * in MainModule would apply it in production but not under test.
 */
@Module({
  providers: [
    { provide: APP_PIPE, useClass: ZodValidationPipe },
    { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
    { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
  ],
})
export class HttpCoreModule {}
