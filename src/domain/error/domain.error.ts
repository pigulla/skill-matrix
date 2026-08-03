export abstract class DomainError extends Error {
  public constructor(message: string, cause?: Error) {
    super(message, { cause })
  }
}
