import { HttpStatus, type INestApplication } from '@nestjs/common'
import { APP_FILTER, APP_INTERCEPTOR, APP_PIPE } from '@nestjs/core'
import { Test } from '@nestjs/testing'
import { ZodSerializerInterceptor, ZodValidationPipe } from 'nestjs-zod'
import request from 'supertest'
import type { JsonObject } from 'type-fest'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { ITeamSkillProficienciesService } from '#/application/team/team-skill-proficiencies.service.interface.js'
import { SkillReferenceNotFoundError } from '#/domain/skill/error/skill-reference-not-found.error.js'
import { DuplicateTeamSkillError } from '#/domain/team/error/duplicate-team-skill.error.js'
import { TeamNotFoundError } from '#/domain/team/error/team-not-found.error.js'
import { TeamReferenceNotFoundError } from '#/domain/team/error/team-reference-not-found.error.js'
import { TeamSkillNotFoundError } from '#/domain/team/error/team-skill-not-found.error.js'
import {
  mockTeamSkillProficienciesService,
  type TeamSkillProficienciesServiceMock,
} from '#/mocks.js'
import { DomainErrorsExceptionFilter } from '#/presentation/http/domain-errors-exception-filter.js'
import { TeamSkillsController } from '#/presentation/http/team/team-skills.controller.js'

import { skills, teamSkillProficiencies, teams } from '../fixture/fixture.js'

describe('TeamSkillsController', () => {
  const tsp = teamSkillProficiencies.platform
  const expectedBody = {
    teamId: teams.platform.id,
    skills: [
      { skillId: skills.backendDevelopment.id, proficiency: 3 },
      { skillId: skills.softwareArchitecture.id, proficiency: 2 },
    ],
  } satisfies JsonObject

  let serviceMock: TeamSkillProficienciesServiceMock
  let app: INestApplication

  beforeEach(async () => {
    serviceMock = mockTeamSkillProficienciesService()

    const module = await Test.createTestingModule({
      controllers: [TeamSkillsController],
      providers: [
        { provide: APP_INTERCEPTOR, useClass: ZodSerializerInterceptor },
        { provide: APP_FILTER, useClass: DomainErrorsExceptionFilter },
        { provide: APP_PIPE, useClass: ZodValidationPipe },
        { provide: ITeamSkillProficienciesService, useValue: serviceMock },
      ],
    }).compile()

    app = await module.createNestApplication({ logger: false }).enableShutdownHooks().init()
  })

  afterEach(() => app.close())

  describe('GET /teams/:teamId/skills', () => {
    it('should return 200 OK', async () => {
      serviceMock.get.mockResolvedValue(tsp)

      await request(app.getHttpServer())
        .get(`/teams/${teams.platform.id}/skills`)
        .expect(HttpStatus.OK)
        .expect(expectedBody)

      expect(serviceMock.get).toHaveBeenCalledExactlyOnceWith({ teamId: teams.platform.id })
    })

    it('should return 404 when the team does not exist', async () => {
      serviceMock.get.mockRejectedValue(new TeamNotFoundError(teams.platform.id))

      await request(app.getHttpServer())
        .get(`/teams/${teams.platform.id}/skills`)
        .expect(HttpStatus.NOT_FOUND)
    })
  })

  describe('POST /teams/:teamId/skills/:skillId', () => {
    it('should return 201 Created', async () => {
      serviceMock.add.mockResolvedValue(tsp)

      await request(app.getHttpServer())
        .post(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.CREATED)
        .expect(expectedBody)

      expect(serviceMock.add).toHaveBeenCalledExactlyOnceWith({
        teamId: teams.platform.id,
        skillId: skills.backendDevelopment.id,
        proficiency: 3,
      })
    })

    it('should return 409 Conflict when the skill is already associated', async () => {
      serviceMock.add.mockRejectedValue(
        new DuplicateTeamSkillError(teams.platform.id, skills.backendDevelopment.id),
      )

      await request(app.getHttpServer())
        .post(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.CONFLICT)
    })

    it('should return 422 when the skill does not exist', async () => {
      serviceMock.add.mockRejectedValue(
        new SkillReferenceNotFoundError(skills.backendDevelopment.id),
      )

      await request(app.getHttpServer())
        .post(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY)
    })

    it('should return 422 when the team does not exist as a reference', async () => {
      serviceMock.add.mockRejectedValue(new TeamReferenceNotFoundError(teams.platform.id))

      await request(app.getHttpServer())
        .post(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 3 })
        .expect(HttpStatus.UNPROCESSABLE_ENTITY)
    })

    it.each<[string, JsonObject | string]>([
      ['no body', ''],
      ['proficiency above range', { proficiency: 5 }],
      ['proficiency below range', { proficiency: -1 }],
      ['non-integer proficiency', { proficiency: 1.5 }],
    ])('should return 400 Bad Request with %s', async (_label, body) => {
      await request(app.getHttpServer())
        .post(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send(body)
        .expect(HttpStatus.BAD_REQUEST)

      expect(serviceMock.add).not.toHaveBeenCalled()
    })
  })

  describe('PUT /teams/:teamId/skills/:skillId', () => {
    it('should return 200 OK', async () => {
      serviceMock.update.mockResolvedValue(tsp)

      await request(app.getHttpServer())
        .put(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.OK)
        .expect(expectedBody)

      expect(serviceMock.update).toHaveBeenCalledExactlyOnceWith({
        teamId: teams.platform.id,
        skillId: skills.backendDevelopment.id,
        proficiency: 4,
      })
    })

    it('should return 404 when the association does not exist', async () => {
      serviceMock.update.mockRejectedValue(
        new TeamSkillNotFoundError(teams.platform.id, skills.backendDevelopment.id),
      )

      await request(app.getHttpServer())
        .put(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send({ proficiency: 4 })
        .expect(HttpStatus.NOT_FOUND)
    })

    it.each<[string, JsonObject | string]>([
      ['no body', ''],
      ['proficiency above range', { proficiency: 5 }],
      ['proficiency below range', { proficiency: -1 }],
      ['non-integer proficiency', { proficiency: 1.5 }],
    ])('should return 400 Bad Request with %s', async (_label, body) => {
      await request(app.getHttpServer())
        .put(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .send(body)
        .expect(HttpStatus.BAD_REQUEST)

      expect(serviceMock.update).not.toHaveBeenCalled()
    })
  })

  describe('DELETE /teams/:teamId/skills/:skillId', () => {
    it('should return 200 OK', async () => {
      serviceMock.remove.mockResolvedValue(tsp)

      await request(app.getHttpServer())
        .delete(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.OK)
        .expect(expectedBody)

      expect(serviceMock.remove).toHaveBeenCalledExactlyOnceWith({
        teamId: teams.platform.id,
        skillId: skills.backendDevelopment.id,
      })
    })

    it('should return 404 when the association does not exist', async () => {
      serviceMock.remove.mockRejectedValue(
        new TeamSkillNotFoundError(teams.platform.id, skills.backendDevelopment.id),
      )

      await request(app.getHttpServer())
        .delete(`/teams/${teams.platform.id}/skills/${skills.backendDevelopment.id}`)
        .expect(HttpStatus.NOT_FOUND)
    })
  })
})
