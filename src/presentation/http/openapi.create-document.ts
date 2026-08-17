import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'

import type { OpenApiSettings } from './openapi.settings.js'
import { OpenApiTag } from './openapi.tag.js'

export function createOpenApiDocument(
  app: INestApplication,
  settings: OpenApiSettings,
): OpenAPIObject {
  const documentBuilder = new DocumentBuilder()
    .setTitle(settings.title)
    .setDescription(settings.description)
    .setVersion(settings.version)
    .setLicense(settings.license.name, settings.license.url)
    .setContact(settings.contact.name, settings.contact.url, settings.contact.email)
    .addServer(settings.server)
    .addBearerAuth()
    .addSecurityRequirements('bearer')

  // biome-ignore lint/suspicious/useIterableCallbackReturn: It's fine.
  Object.values(OpenApiTag).forEach(({ name, description }) =>
    documentBuilder.addTag(name, description),
  )

  const document = SwaggerModule.createDocument(app, documentBuilder.build())

  return cleanupOpenApiDoc(document)
}
