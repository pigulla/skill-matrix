import { z } from 'zod'

export const openApiSettings = z
  .object({
    server: z.url({ protocol: /^https?$/ }),
    title: z.string(),
    description: z.string(),
    version: z.string(),
    license: z.strictObject({
      name: z.string(),
      url: z.url({ protocol: /^https?$/ }),
    }),
    contact: z.strictObject({
      name: z.string(),
      url: z.url({ protocol: /^https?$/ }),
      email: z.email(),
    }),
  })
  .readonly()
  .brand('openapi-settings')

export type OpenApiSettings = z.infer<typeof openApiSettings>
