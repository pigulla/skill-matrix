import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { SwaggerModule } from '@nestjs/swagger'
import { Logger } from 'nestjs-pino'

import { getVersion } from '#/get-version.js'
import { OPEN_API_CONFIG, type OpenApiConfig } from '#/infrastructure/config/open-api.config.js'
import { SERVER_CONFIG, type ServerConfig } from '#/infrastructure/config/server.config.js'
import { MainModule } from '#/module/main.module.js'
import { createOpenApiDocument } from '#/presentation/http/openapi.create-document.js'
import { openApiSettings } from '#/presentation/http/openapi.settings.js'

export async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(MainModule, { bufferLogs: true })

  const server = app.get<ServerConfig>(SERVER_CONFIG)
  const openApi = app.get<OpenApiConfig>(OPEN_API_CONFIG)
  const version = await getVersion()
  const logger = app.get(Logger)

  app.enableShutdownHooks([], { useProcessExit: true }).useLogger(logger)
  app.disable('x-powered-by')

  if (openApi.swagger.enabled) {
    const settings = openApiSettings.parse({ ...openApi, version })
    SwaggerModule.setup(openApi.swagger.path, app, () => createOpenApiDocument(app, settings))
  }

  await app.listen(server.port, server.hostname, async () => {
    const url = await app.getUrl()
    logger.log(`Server (${version}) listening on ${url}`)
  })
}

void bootstrap()
