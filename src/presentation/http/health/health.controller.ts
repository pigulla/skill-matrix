import { Controller, Get } from '@nestjs/common'
import { ApiOperation, ApiTags } from '@nestjs/swagger'
import { HealthCheck, type HealthCheckResult, HealthCheckService } from '@nestjs/terminus'

import { OpenApiTag } from '../openapi.tag.js'

@Controller('health')
@ApiTags(OpenApiTag.HEALTH.name)
export class HealthController {
  private readonly health: HealthCheckService

  public constructor(health: HealthCheckService) {
    this.health = health
  }

  @Get()
  @HealthCheck()
  @ApiOperation({
    operationId: 'health.check',
    summary: 'Health check.',
    description: 'Check the health of the service.',
  })
  public check(): Promise<HealthCheckResult> {
    // No connectivity check to the database, a simple "service itself is up" suffices for now.
    return this.health.check([])
  }
}
