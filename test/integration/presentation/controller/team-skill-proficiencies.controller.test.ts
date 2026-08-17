import { HttpStatus, type INestApplication } from '@nestjs/common'
import request from 'supertest'
import { afterAll, afterEach, beforeAll, beforeEach, describe, it } from 'vitest'

import { TeamModule } from '#/module/team.module.js'
import { TeamSkillProficienciesController } from '#/presentation/http/team/skill-proficiencies/team-skill-proficiencies.controller.js'

import { UNKNOWN_SKILL_ID, UNKNOWN_TEAM_ID } from '../../../util/entity-ids.js'
import { skills, teamSkillProficiencies, teams } from '../../fixture/fixture.js'
import { setupIntegrationTest } from '../../fixture/setup-integration-test.js'

describe('TeamSkillProficienciesController', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: TeamSkillProficienciesController.name,
        imports: [TeamModule],
      })
      .compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  describe('GET /teams/:teamId/skill-proficiencies', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.traffic.id}/skill-proficiencies`)
        .expect(HttpStatus.OK)
        .expect(teamSkillProficiencies.traffic.toJSON()))

    it('should return an empty list for a team with no skills', () =>
      request(app.getHttpServer())
        .get(`/teams/${teams.testing.id}/skill-proficiencies`)
        .expect(HttpStatus.OK)
        .expect(teamSkillProficiencies.testing.toJSON()))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .get(`/teams/${UNKNOWN_TEAM_ID}/skill-proficiencies`)
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('POST /teams/:teamId/skill-proficiencies/:skillId', () => {
    it('should return 201 Created', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.qualityAssurance.id}`)
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

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .send({ proficiency: 5 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .send({ proficiency: 2, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 409 Conflict if the skill is already associated', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.CONFLICT))

    it('should return 404 Not Found if the skill does not exist', () =>
      request(app.getHttpServer())
        .post(`/teams/${teams.traffic.id}/skill-proficiencies/${UNKNOWN_SKILL_ID}`)
        .send({ proficiency: 2 })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .post(`/teams/${UNKNOWN_TEAM_ID}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .send({ proficiency: 2 })
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('PUT /teams/:teamId/skill-proficiencies/:skillId', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.backendDevelopment.id}`)
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

    it('should return 400 Bad Request if a payload property is malformed', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.backendDevelopment.id}`)
        .send({ proficiency: -1 })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 400 Bad Request if the payload contains an unknown property', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.backendDevelopment.id}`)
        .send({ proficiency: 4, extraneous: 'nope' })
        .expect(HttpStatus.BAD_REQUEST))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .put(`/teams/${UNKNOWN_TEAM_ID}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.NOT_FOUND))

    it('should return 404 Not Found if the skill is not associated with the team', () =>
      request(app.getHttpServer())
        .put(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.NOT_FOUND))
  })

  describe('DELETE /teams/:teamId/skill-proficiencies/:skillId', () => {
    it('should return 200 OK', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.OK)
        .expect({
          teamId: teams.traffic.id,
          skills: [
            { skillId: skills.frontendDevelopment.id, proficiency: 3 },
            { skillId: skills.softwareArchitecture.id, proficiency: 2 },
          ],
        }))

    it('should return 404 Not Found if the team does not exist', () =>
      request(app.getHttpServer())
        .delete(`/teams/${UNKNOWN_TEAM_ID}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .expect(HttpStatus.NOT_FOUND))

    it('should return 404 Not Found if the skill is not associated with the team', () =>
      request(app.getHttpServer())
        .delete(`/teams/${teams.traffic.id}/skill-proficiencies/${skills.qualityAssurance.id}`)
        .expect(HttpStatus.NOT_FOUND))
  })
})
