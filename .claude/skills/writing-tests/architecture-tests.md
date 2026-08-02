# Architecture Tests

Live under `test/architecture/`. Runner: `npm run vitest:architecture` (excluded from the coverage run). They enforce the Clean Architecture import rules with **TSArch** — a layer must not import from layers it isn't allowed to depend on.

## You don't hand-write these tests

`clean-architecture.test.ts` is a generic, data-driven runner: it reads `rules.json`, expands every rule into a test case, and asserts no forbidden import exists. To change what's allowed, **edit `rules.json` — do not touch the test file.**

## Declaring a rule in `rules.json`

The file is a map of `source component → array of rules`. Each rule has:

- `mustNotImportFrom`: a component name or array of names the source may not import from.
- `exceptFor` (optional): file-suffix exceptions that _are_ allowed to be imported despite the ban — e.g. `"interfaces"` → `*.interface.ts`, `"errors"` → `*.error.ts`, `"configs"` → `*.config.ts` (the exception name is the suffix without the trailing `s`).

```json
"presentation": [
  { "mustNotImportFrom": "module" },
  { "mustNotImportFrom": "application", "exceptFor": ["interfaces", "errors"] }
]
```

This says presentation files may not import from `module` at all, and may not import from `application` **except** its `*.interface.ts` and `*.error.ts` files (the input-boundary pattern: controllers depend on application interfaces/errors, never on concrete services).

## Valid values are fixed by the schema

`rules.schema.ts` validates `rules.json` at test time, so a typo fails fast. Allowed:

- **Components** (must match the directory names in `src/`): `application`, `domain`, `presentation`, `infrastructure`, `module`, `util`.
- **Exceptions**: `errors`, `interfaces`, `configs`.

Adding a new layer or a new suffix exception means updating `rules.schema.ts` (the `COMPONENT` / `EXCEPTION` maps and their Zod unions) as well as `rules.json`.

## Workflow

1. Change or add a rule in `rules.json` (add a new exception suffix or component to `rules.schema.ts` first if needed).
2. Run `npm run vitest:architecture`; a violation lists the offending files.
3. Fix by moving code or correcting the import — not by loosening a rule unless the architecture genuinely changed. The layer/import contract mirrors the table in `AGENTS.md`.
