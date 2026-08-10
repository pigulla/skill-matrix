import { NestFactory } from '@nestjs/core'

import { getVersion } from '#/get-version.js'
import { OPEN_API_CONFIG, type OpenApiConfig } from '#/infrastructure/config/open-api.config.js'
import { MainModule } from '#/module/main.module.js'
import { createOpenApiDocument } from '#/presentation/http/openapi.create-document.js'
import { openApiSettings } from '#/presentation/http/openapi.settings.js'

async function buildOpenApiSpec(): Promise<void> {
  const app = await NestFactory.create(MainModule, {
    logger: false,
    abortOnError: false,
  })

  const config = app.get<OpenApiConfig>(OPEN_API_CONFIG)
  const settings = openApiSettings.parse({ ...config, version: await getVersion() })
  const document = createOpenApiDocument(app, settings)

  process.stdout.write(JSON.stringify(document, null, 4))
}

void buildOpenApiSpec()
