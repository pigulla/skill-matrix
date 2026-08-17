import { type INestApplication, Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import type {
  Database,
  TransactionalAdapterPgPromise,
} from '@nestjs-cls/transactional-adapter-pg-promise'
import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

class TestError extends Error {}

@Injectable()
class ResultTransactionalTestService {
  private readonly txHost: TransactionHost<TransactionalAdapterPgPromise>

  public constructor(txHost: TransactionHost<TransactionalAdapterPgPromise>) {
    this.txHost = txHost
  }

  @ResultTransactional()
  public writeThenOk(value: string): ResultAsync<string, TestError> {
    return ResultAsync.fromSafePromise(
      this.txHost.tx.none('INSERT INTO test_rows(value) VALUES ($(value))', { value }),
    ).andThen(() => okAsync(value))
  }

  @ResultTransactional()
  public writeThenErr(value: string): ResultAsync<string, TestError> {
    return ResultAsync.fromSafePromise(
      this.txHost.tx.none('INSERT INTO test_rows(value) VALUES ($(value))', { value }),
    ).andThen(() => errAsync(new TestError('expected failure after a write')))
  }

  @ResultTransactional()
  public async writeThenThrowUnexpected(value: string): Promise<never> {
    await this.txHost.tx.none('INSERT INTO test_rows(value) VALUES ($(value))', { value })

    throw new Error('genuinely unexpected failure')
  }

  @ResultTransactional()
  public writeTwiceThenErr(
    firstValue: string,
    secondValue: string,
  ): ResultAsync<string, TestError> {
    return ResultAsync.fromSafePromise(
      this.txHost.tx.none('INSERT INTO test_rows(value) VALUES ($(value))', {
        value: firstValue,
      }),
    )
      .andThen(() =>
        ResultAsync.fromSafePromise(
          this.txHost.tx.none('INSERT INTO test_rows(value) VALUES ($(value))', {
            value: secondValue,
          }),
        ),
      )
      .andThen(() => errAsync(new TestError('expected failure after the second write')))
  }
}

describe('ResultTransactional', () => {
  const integrationTest = setupIntegrationTest()

  let app: INestApplication
  let testService: ResultTransactionalTestService
  let db: Database

  beforeAll(integrationTest.beforeAll)
  afterAll(integrationTest.afterAll)

  beforeEach(async () => {
    await integrationTest.beforeEach()

    const module = await integrationTest
      .createModule({
        testName: ResultTransactionalTestService.name,
        providers: [ResultTransactionalTestService],
      })
      .compile()

    app = await module.createNestApplication().enableShutdownHooks().init()
    testService = app.get(ResultTransactionalTestService)
    db = app.get(IConnectionProvider).database

    await db.none('CREATE TABLE test_rows (value text NOT NULL)')
  })

  afterEach(async () => {
    await app?.close()
    await integrationTest.afterEach()
  })

  it('commits the write if the method resolves Ok', async () => {
    const result = await testService.writeThenOk('committed')

    expect(result).toEqual(ok('committed'))

    await expect(db.manyOrNone('SELECT * FROM test_rows')).resolves.toEqual([
      { value: 'committed' },
    ])
  })

  it('rolls back the write if the method resolves Err', async () => {
    const result = await testService.writeThenErr('rolled-back')

    expect(result).toEqual(err(new TestError('expected failure after a write')))

    await expect(db.manyOrNone('SELECT * FROM test_rows')).resolves.toEqual([])
  })

  it('rolls back and propagates if the method throws unexpectedly', async () => {
    await expect(testService.writeThenThrowUnexpected('unexpected')).rejects.toThrow(
      'genuinely unexpected failure',
    )

    await expect(db.manyOrNone('SELECT * FROM test_rows')).resolves.toEqual([])
  })

  it('rolls back both writes if a later write resolves Err', async () => {
    const result = await testService.writeTwiceThenErr('first-write', 'second-write')

    expect(result).toEqual(err(new TestError('expected failure after the second write')))

    await expect(db.manyOrNone('SELECT * FROM test_rows')).resolves.toEqual([])
  })
})
