export class TransactionConflictError extends Error {
  public constructor(cause: Error) {
    super(
      'The transaction was rolled back because it conflicted with another one running at the same time. Retrying the request may succeed.',
      { cause },
    )
  }
}
