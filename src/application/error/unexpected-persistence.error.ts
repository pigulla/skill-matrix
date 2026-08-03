export class UnexpectedPersistenceError extends Error {
  public constructor(cause: Error) {
    super('An unexpected persistence error occurred', { cause })
  }
}
