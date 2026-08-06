import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { DuplicateExampleKindIdError } from '#/domain/example/kind/error/duplicate-example-kind-id.error.js'
import type { DuplicateExampleKindNameError } from '#/domain/example/kind/error/duplicate-example-kind-name.error.js'
import type { ExampleKindInUseError } from '#/domain/example/kind/error/example-kind-in-use.error.js'
import type { ExampleKindNotFoundError } from '#/domain/example/kind/error/example-kind-not-found.error.js'
import { ExampleKind, type Properties } from '#/domain/example/kind/example-kind.js'
import { IExampleKindRepository } from '#/domain/example/kind/example-kind.repository.interface.js'
import type { ExampleKindID } from '#/domain/example/kind/example-kind-id.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { IExampleKindService } from './example-kind.service.interface.js'
import { IExampleKindUuidProvider } from './example-kind-uuid-provider.interface.js'

@Injectable()
export class ExampleKindService implements IExampleKindService {
  private readonly exampleKindRepository: IExampleKindRepository
  private readonly uuidProvider: IExampleKindUuidProvider

  public constructor(
    exampleKindRepository: IExampleKindRepository,
    uuidProvider: IExampleKindUuidProvider,
  ) {
    this.exampleKindRepository = exampleKindRepository
    this.uuidProvider = uuidProvider
  }

  @ResultTransactional()
  public getAll(): ResultAsync<ExampleKind[], never> {
    return this.exampleKindRepository.getAll()
  }

  @ResultTransactional()
  public get(id: ExampleKindID): ResultAsync<ExampleKind, ExampleKindNotFoundError> {
    return this.exampleKindRepository.get(id)
  }

  @ResultTransactional()
  public delete(
    id: ExampleKindID,
  ): ResultAsync<void, ExampleKindNotFoundError | ExampleKindInUseError> {
    return this.exampleKindRepository.delete(id)
  }

  @ResultTransactional()
  public create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<ExampleKind, DuplicateExampleKindIdError | DuplicateExampleKindNameError> {
    const id = this.uuidProvider.generate()
    const exampleKind = new ExampleKind({ ...properties, id })

    return this.exampleKindRepository.create(exampleKind)
  }

  @ResultTransactional()
  public update(
    properties: SetRequired<Partial<Properties>, 'id'>,
  ): ResultAsync<ExampleKind, ExampleKindNotFoundError | DuplicateExampleKindNameError> {
    return this.exampleKindRepository
      .get(properties.id)
      .andThen(existing => this.exampleKindRepository.update(existing.update(properties)))
  }
}
