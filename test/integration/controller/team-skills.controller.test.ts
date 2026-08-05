import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

import { asSkillID } from '#/domain/skill/skill-id.js'
import { asTeamID } from '#/domain/team/team-id.js'
import { TeamModule } from '#/module/team.module.js'
import { TeamSkillsController } from '#/presentation/http/team/team-skills.controller.js'

import { skills, teamSkillProficiencies, teams } from '../fixture/fixture.js'
import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

describe('TeamSkillsController', () => {
  const unknownTeamId = asTeamID('00000000-0002-4000-8000-000000000000')
  const unknownSkillId = asSkillID('00000000-0003-4000-8000-000000000000')
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: TeamSkillsController.name,
        imports: [TeamModule],
      })
      .compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('GET /teams/:teamId/skills', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.traffic.id}/skills`)
        .expect(HttpStatus.OK)
        .expect(teamSkillProficiencies.traffic.toJSON()))

    it('should return an empty list for a team with no skills', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.testing.id}/skills`)
        .expect(HttpStatus.OK)
        .expect(teamSkillProficiencies.testing.toJSON()))

    it('should return 404 Not Found', () =>
      request(app.getHttpServer())
        .get(`/teams/${unknownTeamId}/skills`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /teams/:teamId/skills/:skillId', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skills/${skills.qualityAssurance.id}`)
        .send({ proficiency: 2 })
        .expect(HttpStatus.CREATED)
        .expect({
          teamId: teams.traffic.id,
          skills: [
            { skillId: skills.frontendDevelopment.id, proficiency: 3 },
            { skillId: skills.backendDevelopment.id, proficiency: 2 },
            { skillId: skills.softwareArchitecture.id, proficiency: 2 },
            { skillId: skills.qualityAssurance.id, proficiency: 2 },
          ],
        }))

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skills/${skills.qualityAssurance.id}`)
        .send({ proficiency: 5 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skills/${skills.qualityAssurance.id}`)
        .send({ proficiency: 2, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict when the skill is already associated', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.CONFLICT))

    it('should return 422 Unprocessable Entity if the skill does not exist', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skills/${unknownSkillId}`)
        .send({ proficiency: 2 })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))

    it('should return 422 Unprocessable Entity if the team does not exist', () =>
      request(app.getHttpServer())
        .post(`/teams/${unknownTeamId}/skills/${skills.qualityAssurance.id}`)
        .send({ proficiency: 2 })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY))
  })

  describe('PUT /teams/:teamId/skills/:skillId', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.OK)
        .expect({
          teamId: teams.traffic.id,
          skills: [
            { skillId: skills.frontendDevelopment.id, proficiency: 3 },
            { skillId: skills.backendDevelopment.id, proficiency: 4 },
            { skillId: skills.softwareArchitecture.id, proficiency: 2 },
          ],
        }))

    it('should return 400 Bad Request if a property is malformed', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: -1 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 4, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found when the association does not exist', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skills/${skills.qualityAssurance.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /teams/:teamId/skills/:skillId', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.traffic.id}/skills/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.OK)
        .expect({
          teamId: teams.traffic.id,
          skills: [
            { skillId: skills.frontendDevelopment.id, proficiency: 3 },
            { skillId: skills.softwareArchitecture.id, proficiency: 2 },
          ],
        }))

    it('should return 404 Not Found when the association does not exist', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.traffic.id}/skills/${skills.qualityAssurance.id}`)
        .expect(HttpStatus.NOT_FOUND))
  })
})
