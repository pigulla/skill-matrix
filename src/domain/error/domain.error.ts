export abstract class DomainError extends Error {
  protected constructor(message: string, cause?: Error) {
    super(message, { cause })
  }
}
