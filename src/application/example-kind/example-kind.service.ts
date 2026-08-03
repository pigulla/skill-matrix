import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'

import type { DuplicateExampleKindError } from '#/domain/example-kind/error/duplicate-example-kind.error.js'
import type { ExampleKindInUseError } from '#/domain/example-kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example-kind/error/example-kind-not-found.error.js'
import type { ExampleKind } from '#/domain/example-kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example-kind/example-kind.repository.interface.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { IExampleKindService } from './example-kind.service.interface.js'

@Injectable()
export class ExampleKindService implements IExampleKindService {
  private readonly exampleKindRepository: IExampleKindRepository

  public constructor(exampleKindRepository: IExampleKindRepository) {
    this.exampleKindRepository = exampleKindRepository
  }

  @ResultTransactional()
  public getAll(): ResultAsync<ExampleKind[], never> {
    return this.exampleKindRepository.getAll()
  }

  @ResultTransactional()
  public get(kind: ExampleKind): ResultAsync<ExampleKind, ExampleKindNotFoundError> {
    return this.exampleKindRepository.get(kind)
  }

  @ResultTransactional()
  public create(kind: ExampleKind): ResultAsync<ExampleKind, DuplicateExampleKindError> {
    return this.exampleKindRepository.create(kind)
  }

  @ResultTransactional()
  public delete(
    kind: ExampleKind,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError> {
    return this.exampleKindRepository.delete(kind)
  }
}
