import { type INestApplication, Injectable } from '@nestjs/common'
import { TransactionHost } from '@nestjs-cls/transactional'
import type {
  Database,
  TransactionalAdapterPgPromise,
} from '@nestjs-cls/transactional-adapter-pg-promise'
import { err, errAsync, ok, okAsync, ResultAsync } from 'neverthrow'
import { DatabaseError } from 'pg-protocol'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { TransactionConflictError } from '#/application/error/transaction-conflict.error.js'
import { UnexpectedPersistenceError } from '#/application/error/unexpected-persistence.error.js'
import { IConnectionProvider } from '#/infrastructure/persistence/connection-provider.interface.js'
import { ResultTransactional } from '#/util/result-transactional.decorator.js'

import { setupIntegrationTest } from '../fixture/setup-integration-test.js'

class TestError extends Error {}

function syntheticDatabaseError(code: string): DatabaseError {
  const error = new DatabaseError('simulated', 0, 'error')
  error.code = code
  return error
}

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

  @ResultTransactional()
  public failsWithRawTransientError(): never {
    throw syntheticDatabaseError('40001')
  }

  @ResultTransactional()
  public failsWithWrappedTransientError(): never {
    throw new UnexpectedPersistenceError(syntheticDatabaseError('40P01'))
  }

  @ResultTransactional()
  public failsWithNonTransientError(): never {
    throw new UnexpectedPersistenceError(syntheticDatabaseError('23505'))
  }

  @ResultTransactional()
  public incrementViaReadThenWrite(hook: () => Promise<void>): ResultAsync<null, never> {
    return ResultAsync.fromSafePromise(
      this.txHost.tx.one<{ value: number }>('SELECT value FROM test_counters WHERE id = 1'),
    ).andThen(row =>
      ResultAsync.fromSafePromise(
        hook().then(() =>
          this.txHost.tx.none('UPDATE test_counters SET value = $(value) WHERE id = 1', {
            value: row.value + 1,
          }),
        ),
      ),
    )
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
    await db.none('CREATE TABLE test_counters (id INT PRIMARY KEY, value INT NOT NULL)')
    await db.none('INSERT INTO test_counters (id, value) VALUES (1, 0)')
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

  it('translates a raw commit-time-shaped failure into a TransactionConflictError', async () => {
    await expect(testService.failsWithRawTransientError()).rejects.toThrow(TransactionConflictError)
  })

  it('translates a wrapped mid-transaction-shaped failure into a TransactionConflictError', async () => {
    await expect(testService.failsWithWrappedTransientError()).rejects.toThrow(
      TransactionConflictError,
    )
  })

  it('leaves an unrelated persistence error alone', async () => {
    await expect(testService.failsWithNonTransientError()).rejects.toThrow(
      UnexpectedPersistenceError,
    )
  })

  it('recovers from real contention without retrying', async () => {
    let resolveAHasRead!: () => void
    let resolveReleaseA!: () => void

    const aHasRead = new Promise<void>(resolve => {
      resolveAHasRead = resolve
    })
    const releaseA = new Promise<void>(resolve => {
      resolveReleaseA = resolve
    })

    const callA = testService.incrementViaReadThenWrite(async () => {
      resolveAHasRead()
      await releaseA
    })

    await aHasRead

    await testService.incrementViaReadThenWrite(async () => {})

    resolveReleaseA()

    await expect(callA).rejects.toThrow(TransactionConflictError)

    await expect(db.one('SELECT value FROM test_counters WHERE id = 1')).resolves.toEqual({
      value: 1,
    })
  })
})
