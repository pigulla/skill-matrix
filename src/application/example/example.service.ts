import { Injectable } from '@nestjs/common'
import type { ResultAsync } from 'neverthrow'
import type { Except, SetRequired } from 'type-fest'

import type { ConcurrencyToken } from '#/domain/concurrency-token.js'
import type { DuplicateExampleIdError } from '#/domain/example/error/duplicate-example-id.error.js'
import type { DuplicateExampleNameError } from '#/domain/example/error/duplicate-example-name.error.js'
import type { ExampleConcurrencyError } from '#/domain/example/error/example-concurrency.error.js'
import type { ExampleInUseError } from '#/domain/example/error/example-in-use.error.js'
import type { ExampleNotFoundError } from '#/domain/example/error/example-not-found.error.js'
import { Example, type Properties } from '#/domain/example/example.js'
import { IExampleRepository } from '#/domain/example/example.repository.interface.js'
import type { ExampleID } from '#/domain/example/example-id.js'
import type { ExampleKindReferenceNotFoundError } from '#/domain/example/kind/error/example-kind-reference-not-found.error.js'
import type { WithConcurrencyToken } from '#/domain/with-concurrency-token.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

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

  @ResultTransactional()
  public getAll(): ResultAsync<Example[], never> {
    return this.exampleRepository.getAll()
  }

  @ResultTransactional()
  public get(id: ExampleID): ResultAsync<WithConcurrencyToken<Example>, ExampleNotFoundError> {
    return this.exampleRepository.get(id)
  }

  @ResultTransactional()
  public create(
    properties: Except<Properties, 'id'>,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    DuplicateExampleIdError | DuplicateExampleNameError | ExampleKindReferenceNotFoundError
  > {
    const id = this.uuidProvider.generate()
    const example = new Example({ ...properties, id })

    return this.exampleRepository.create(example)
  }

  @ResultTransactional()
  public update(
    properties: SetRequired<Partial<Properties>, 'id'>,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<
    WithConcurrencyToken<Example>,
    | ExampleNotFoundError
    | DuplicateExampleNameError
    | ExampleKindReferenceNotFoundError
    | ExampleConcurrencyError
  > {
    return this.exampleRepository
      .get(properties.id)
      .andThen(existing =>
        this.exampleRepository.update(existing.value.update(properties), expectedToken),
      )
  }

  @ResultTransactional()
  public delete(
    id: ExampleID,
    expectedToken: ConcurrencyToken,
  ): ResultAsync<void, ExampleNotFoundError | ExampleInUseError | ExampleConcurrencyError> {
    return this.exampleRepository.delete(id, expectedToken)
  }
}
