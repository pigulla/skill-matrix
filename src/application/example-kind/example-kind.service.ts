import { Injectable } from '@nestjs/common'
import { Transactional } from '@nestjs-cls/transactional'

import type { ExampleKind } from '#/domain/example-kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example-kind/example-kind.repository.interface.js'

import { IExampleKindService } from './example-kind.service.interface.js'

@Injectable()
export class ExampleKindService implements IExampleKindService {
  private readonly exampleKindRepository: IExampleKindRepository

  public constructor(exampleKindRepository: IExampleKindRepository) {
    this.exampleKindRepository = exampleKindRepository
  }

  @Transactional()
  public getAll(): Promise<ExampleKind[]> {
    return this.exampleKindRepository.getAll()
  }

  @Transactional()
  public get(kind: ExampleKind): Promise<ExampleKind> {
    return this.exampleKindRepository.get(kind)
  }

  @Transactional()
  public create(kind: ExampleKind): Promise<ExampleKind> {
    return this.exampleKindRepository.create(kind)
  }

  @Transactional()
  public delete(kind: ExampleKind): Promise<void> {
    return this.exampleKindRepository.delete(kind)
  }
}
