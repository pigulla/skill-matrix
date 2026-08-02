import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'

import { Example } from '#/domain/example/example.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import { type ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKind } from '#/domain/example-kind/example-kind.js'

import { IExampleService } from './example.service.interface.js'
import { IExampleUuidProvider } from './example-uuid-provider.interface.js'

@Injectable()
export class ExampleService implements IExampleService {
  private readonly exampleRepository: IExampleRepository
  private readonly uuidProvider: IExampleUuidProvider

  public constructor(exampleRepository: IExampleRepository, uuidProvider: IExampleUuidProvider) {
    this.exampleRepository = exampleRepository
    this.uuidProvider = uuidProvider
  }

  @Transactional()
  public getAll(): Promise<Example[]> {
    return this.exampleRepository.getAll()
  }

  @Transactional()
  public get(id: ExampleID): Promise<Example> {
    return this.exampleRepository.get(id)
  }

  @Transactional()
  public delete(id: ExampleID): Promise<void> {
    return this.exampleRepository.delete(id)
  }

  @Transactional()
  public create(data: { name: string; kind: ExampleKind; url: string | null }): Promise<Example> {
    const id = this.uuidProvider.generate()
    const example = new Example({ ...data, id })

    return this.exampleRepository.create(example)
  }

  @Transactional()
  public update(example: Example): Promise<Example> {
    return this.exampleRepository.update(example)
  }
}
