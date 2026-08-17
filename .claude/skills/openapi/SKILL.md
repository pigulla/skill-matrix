---
name: openapi
description: Use when adding, modifying, or deleting any and file that contains at least one decorator starting with @Api.
model: haiku
effort: medium
paths:
    - src/presentation/**/*
---

# OpenAPI Documentation

## Overview

The OpenAPI documentation is provided via the [@nestjs/swagger](https://github.com/nestjs/swagger) package (its documentation can be found [here](https://docs.nestjs.com/openapi/introduction)).

To create the OpenAPI JSON file, run `npm run openapi:build`. To lint the generated artifact (using the [Redocly CLI](https://redocly.com/docs/cli)), run `npm run openapi:lint`.

## `operationId` convention

Every `@ApiOperation({...})` call must set `operationId`, as the first property in the object literal:

```ts
@ApiOperation({ operationId: 'skills.getAll', summary: 'Get all skills.', description: 'Get all skills.' })
```

- Value format: `<prefix>.<methodName>`
    - `prefix` is the path to the controller's directory. So if it is located in `src/presentation/http/team/skill-proficiencies`, then the value should be `team.skill-proficiencies` (the common `src/presentation/http` prefix is dropped).
    - `methodName` is the exact, literal name of the decorated method (`getAll`, `getOne`, `create`, ...), never a paraphrase.
- Without an explicit `operationId`, NestJS derives one from `${ControllerClass}_${handlerFunctionName}` — but `#/util/unwrap-result.decorator.js`'s `@UnwrapResult()` renames every wrapped handler function to `wrapped`, so every method in a controller collapses onto the same auto-derived id (`${ControllerClass}_wrapped`) and fails Redocly's `operation-operationId-unique` rule. Setting `operationId` explicitly is what avoids this, on every method, not just ones that currently collide.

## Non-negotiable rules

- As part of any final validation, `npm run openapi` must exit cleanly and without errors.
- Every `@ApiOperation` call must have an explicit `operationId` following the convention above.
