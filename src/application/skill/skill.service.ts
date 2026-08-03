import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ExampleReferenceNotFoundError } from '#/domain/example/error/example-reference-not-found.error.js'
import type { DuplicateSkillIdError } from '#/domain/skill/error/duplicate-skill-id.error.js'
import type { DuplicateSkillNameError } from '#/domain/skill/error/duplicate-skill-name.error.js'
import type { SkillInUseError } from '#/domain/skill/error/skill-in-use.error.js'
import type { SkillNotFoundError } from '#/domain/skill/error/skill-not-found.error.js'
import { type Properties, Skill } from '#/domain/skill/skill.js'
import { ISkillRepository } from '#/domain/skill/skill.repository.interface.js'
import type { SkillID } from '#/domain/skill/skill-id.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { ISkillService } from './skill.service.interface.js'
import { ISkillUuidProvider } from './skill-uuid-provider.interface.js'

@Injectable()
export class SkillService implements ISkillService {
  private readonly skillRepository: ISkillRepository
  private readonly uuidProvider: ISkillUuidProvider

  public constructor(skillRepository: ISkillRepository, uuidProvider: ISkillUuidProvider) {
    this.skillRepository = skillRepository
    this.uuidProvider = uuidProvider
  }

  @ResultTransactional()
  public getAll(): ResultAsync<Skill[], never> {
    return this.skillRepository.getAll()
  }

  @ResultTransactional()
  public get(id: SkillID): ResultAsync<Skill, SkillNotFoundError> {
    return this.skillRepository.get(id)
  }

  @ResultTransactional()
  public delete(id: SkillID): ResultAsync<void, SkillInUseError | SkillNotFoundError> {
    return this.skillRepository.delete(id)
  }

  @ResultTransactional()
  public create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    Skill,
    DuplicateSkillIdError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    const id = this.uuidProvider.generate()
    const skill = new Skill({
      id,
      name: properties.name,
      description: properties.description,
      exampleIds: properties.exampleIds,
    })

    return this.skillRepository.create(skill)
  }

  @ResultTransactional()
  public update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<
    Skill,
    SkillNotFoundError | DuplicateSkillNameError | ExampleReferenceNotFoundError
  > {
    return this.skillRepository
      .get(properties.id)
      .andThen(existing => this.skillRepository.update(existing.update(properties)))
  }
}
