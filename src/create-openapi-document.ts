import type { INestApplication } from '@nestjs/common'
import { DocumentBuilder, type OpenAPIObject, SwaggerModule } from '@nestjs/swagger'
import { cleanupOpenApiDoc } from 'nestjs-zod'

import type { OpenApiConfig } from '#/infrastructure/config/open-api.config.js'

export function createOpenAPIDocument(
  app: INestApplication,
  openApiConfig: OpenApiConfig,
): OpenAPIObject {
  const document = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle(openApiConfig.title)
      .setDescription(openApiConfig.description)
      .setVersion(openApiConfig.version)
      .setLicense(openApiConfig.license.name, openApiConfig.license.url)
      .setContact(
        openApiConfig.contact.name,
        openApiConfig.contact.url,
        openApiConfig.contact.email,
      )
      .addServer(openApiConfig.server)
      .addBearerAuth()
      .addSecurityRequirements('bearer')
      .build(),
  )

  return cleanupOpenApiDoc(document)
}
