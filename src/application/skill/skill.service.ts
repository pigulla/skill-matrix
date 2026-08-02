import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'
import type { Except } from 'type-fest'

import { type Properties, Skill } from '#/domain/skill/skill.js'
import { ISkillRepository } from '#/domain/skill/skill.repository.interface.js'
import { type SkillID } from '#/domain/skill/skill-id.js'

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

  @Transactional()
  public getAll(): Promise<Skill[]> {
    return this.skillRepository.getAll()
  }

  @Transactional()
  public get(id: SkillID): Promise<Skill> {
    return this.skillRepository.get(id)
  }

  @Transactional()
  public delete(id: SkillID): Promise<void> {
    return this.skillRepository.delete(id)
  }

  @Transactional()
  public create(properties: Except<Properties, 'id'>): Promise<Skill> {
    const id = this.uuidProvider.generate()
    const skill = new Skill({
      id,
      name: properties.name,
      description: properties.description,
      exampleIds: properties.exampleIds,
    })

    return this.skillRepository.create(skill)
  }

  @Transactional()
  public async update(properties: Properties): Promise<Skill> {
    const skill = await this.skillRepository.get(properties.id)
    const updated = skill.update(properties)

    return await this.skillRepository.update(updated)
  }
}
