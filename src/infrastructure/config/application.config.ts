import { z } from 'zod'

export const APPLICATION_CONFIG = Symbol('application-config')

export const applicationConfig = z
  .strictObject({
    isProduction: z.boolean(),
  })
  .readonly()
  .brand('application-config')

export type ApplicationConfig = z.infer<typeof applicationConfig>
