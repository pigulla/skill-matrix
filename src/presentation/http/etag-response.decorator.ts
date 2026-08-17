import { UseInterceptors } from '@nestjs/common'

import { ETagInterceptor } from './etag.interceptor.js'

export function ETagResponse(): MethodDecorator {
  return UseInterceptors(ETagInterceptor)
}
