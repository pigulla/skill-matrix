---
status: "accepted"
date: 2026-08-20
---

# DTO Construction

## Context and Problem Statement

Every HTTP request and response shape in this application overlaps heavily with a domain entity: the same field names, the same types, the same constraints. The domain already expresses all of that as a Zod schema, because domain objects validate their own invariants on construction (see [002](002-error-handling-strategy.md)). The presentation layer needs shapes that are validated at the boundary, documented in the generated OpenAPI spec, and converted to and from domain objects.

Two questions follow. Should the DTO schemas restate what the domain schema already says, or derive from it? And where should a property's human-readable documentation live, given that the same sentence is useful both to someone reading the domain model and to a consumer of the API?

The two plausible answers pull against each other. Restating everything insulates the public contract from internal model changes but duplicates every constraint, and duplicated constraints drift. Deriving everything removes the duplication but couples the wire format to the domain model. How much of the domain schema should the HTTP boundary reuse, and what must it still own?

## Decision Drivers

- A request the domain would reject must fail at the boundary as a `400`; it must never reach an entity constructor.
- Exposing a domain field over HTTP must be an explicit, reviewable decision, not a consequence of adding it to an entity.
- Validation rules should have exactly one definition — two definitions of "a valid email address" will eventually disagree.
- Low cognitive overhead for contributors who touch the project infrequently: one place to look to answer "what is a valid X?".
- The domain must stay independently understandable and must not know that HTTP exists.
- Documentation should live where the thing it documents is defined, and should not be duplicated.
- Long-term maintainability over short-term convenience.

## Considered Options

- Standalone DTO schemas that restate field types, constraints and documentation
- DTO schemas derived from the domain schema, with property documentation on the domain schema
- Serializing domain objects directly, with no DTO layer

## Decision Outcome

Chosen option: "DTO schemas derived from the domain schema, with property documentation on the domain schema", because it gives every constraint a single definition — which is what keeps a malformed request a `400` rather than a `500` — while `.pick()` keeps field exposure an explicit per-field decision rather than an automatic consequence of the domain model.

### How and where DTOs are constructed

- **Request and response schemas live in `src/presentation/http/<entity>/<entity>.dto.ts`** and are built from the domain schema: `userSchema.pick({ email: true, firstName: true, ... }).strict().brand('create-user-dto')`. [`nestjs-zod`](https://github.com/BenLorantfy/nestjs-zod)'s `createZodDto` turns each schema into the class that the `@ApiBody` / `@ApiResponse` decorators reference.
- **`.pick()` is an allowlist.** Adding a field to a domain entity never exposes it over HTTP until someone names it in a DTO schema. This is the property that makes derivation safe rather than merely convenient.
- **A field whose wire shape genuinely differs is redeclared, not picked.** `skill.dto.ts` declares `exampleIds` as a `z.array` with a uniqueness refinement where the domain holds a `z.set`, replacing the picked field via `.extend()`.
- **Only one converter direction exists.** `fromDomain(entity): XDTO` lives in the DTO file. There is deliberately no `toDomain()`, and nowhere to put one: entities are constructed in the application layer because that layer owns ID generation (`I<Entity>UuidProvider.generate()`), so a presentation-layer converter could not produce an entity for a create.
- **What crosses into the application layer is a plain object shaped like the entity's `Properties`** (`z.infer` of the domain schema). Because the DTO schema derives from the same source, the two shapes cannot fall out of step quietly: renaming a domain field is a compile error in the DTO's `.pick()`. Where the wire shape differs from the domain shape, the controller maps explicitly — `skills.controller.ts` passes `exampleIds: new Set(dto.exampleIds)`.

### Where property documentation lives

- **`.meta({ description, example })` stays on the domain schema.** It describes the business entity, not the API: `'The email address of the user.'` is true of a `User` whether or not an HTTP layer exists. It is the machine-readable equivalent of a JSDoc comment on the property, and the argument for moving it to the presentation layer would equally move JSDoc there. That `@nestjs/swagger` picks it up is a convenience, not its reason for existing — remove the HTTP adapter and the documentation still belongs where it is, for anyone reading the domain model.
- **Genuinely wire-format metadata goes on the DTO schema.** `uniqueItems: true` in `skill.dto.ts` is a JSON Schema keyword with no meaning to the entity, so it is declared where it is meaningful. That is the dividing line: the domain says what a property _is_, the DTO says how it is _represented_.

### Consequences

- Good, because every constraint has exactly one definition, so a request the domain would reject is rejected by the DTO first.
- Good, because the opposite failure mode is avoided by construction. `InvalidEntityError` is thrown rather than returned ([002](002-error-handling-strategy.md)) and is not one of the errors `DomainErrorsExceptionFilter` maps, so a DTO laxer than its domain schema would surface a bad request as a `500` instead of a `400`. Derivation makes that unrepresentable.
- Good, because exposure over HTTP is opt-in per field.
- Good, because a property is documented once, at its definition, and that documentation is useful independently of OpenAPI.
- Bad, because renaming or re-constraining a domain field silently changes the public contract: the DTO, the generated spec and the controller tests all move with it and nothing fails. Acceptable while the API has no external consumers; the mitigation when that changes is a committed spec diff or contract tests, not decoupling the schemas.
- Bad, because it makes available a test shortcut that will eventually expire. The controller integration tests assert against `entity.toJSON()` and send it as the request payload rather than constructing the expected DTO, which is convenient but sound only while the two shapes coincide. `toJSON()` is the entity's own serialization, not a second copy of `fromDomain()`; when a DTO and its entity diverge, those assertions must start building the DTO explicitly and must not be repaired by bending `toJSON()` to fit a presentation concern.
- Bad, because response schemas are currently _defined as_ request schemas (`skillDTOSchema = updateSkillDTOSchema.brand('skill-dto')`), so adding a response-only field requires splitting them first. That is a small, local change when something needs one.
- Bad, because one description serves both the entity and the API; wording them differently would mean overriding at the DTO layer.
- Bad, because a redeclared field restates its description — `skill.dto.ts` repeats the domain's `exampleIds` description verbatim, since it cannot `.pick()` a field whose type it is changing.

## Pros and Cons of the Options

### Standalone DTO schemas

- Good, because the public contract is insulated from the domain: a rename becomes a compile error in the mapper rather than a silent change to the wire format.
- Good, because request and response shapes, and their documentation, can diverge freely from the start.
- Bad, because every constraint exists twice and can drift. A DTO laxer than its domain schema accepts input the entity constructor rejects, and that path produces a `500`, not a `400`.
- Bad, because a contributor answering "what is a valid user email?" has two places to look and no guarantee they agree.

### DTO schemas derived from the domain schema (chosen)

- Good, because of the single-definition and opt-in-exposure properties described under Consequences.
- Neutral, because it still requires a DTO file per entity — derivation removes the duplication, not the layer.
- Bad, because the wire contract follows the domain model, silently.

### Serializing domain objects directly

- Good, because it removes the DTO layer entirely, and every entity already implements `toJSON()`.
- Bad, because every field becomes public by default; exposure stops being a decision and becomes an oversight waiting to happen.
- Bad, because the wire format would follow the in-memory representation (`Set`, `Map`, `Dayjs`) rather than a shape chosen for consumers.
- Bad, because there would be no schema to generate the OpenAPI request and response definitions from.

## More Information

This builds on [002](002-error-handling-strategy.md). The decision there to _throw_ `InvalidEntityError` rather than return it — a domain object should never be constructible in an invalid state, so reaching that path is a programmer error — is what makes boundary validation load-bearing: if the DTO layer ever stops guaranteeing that the domain will accept what it forwards, the result is a `500` rather than a `400`.
