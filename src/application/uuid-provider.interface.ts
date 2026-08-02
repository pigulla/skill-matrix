export abstract class IUuidProvider<T extends string = string> {
  public abstract generate(): T
}
