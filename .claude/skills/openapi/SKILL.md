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

## Non-negotiable rules

- As part of any final validation, `npm run openapi` must exit cleanly and without errors.
