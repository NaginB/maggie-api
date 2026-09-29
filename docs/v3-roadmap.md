# Version 3 delivery record

Version 3.0.0 is released. This document records the completed v3 plan: work that made `maggie-api` safer to expose publicly, easier to customize, and more useful for production applications. Every checked item below is implemented; release-facing changes are summarized in the [changelog](../CHANGELOG.md). For current usage, start with [Getting started](getting-started.md).

## Production hardening follow-ups — delivered

These items were identified during the v3 publish-readiness review and completed before the next v3 release.

- [x] **Secure bulk filters.** `PATCH /bulk` and `DELETE /bulk` now use the same typed, allow-listed filter policy as list routes; client-supplied MongoDB filters are never passed through unchanged.
- [x] **Make bulk writes feature-consistent.** Bulk deletes honor soft-delete behavior, bulk creates and updates receive lifecycle metadata, and bulk updates use the configured Joi update schema.
- [x] **Enforce read-permission intersections.** Client-selected projection fields are intersected with `permissions.readable`, so projection cannot broaden a resource's response fields.
- [x] **Complete OpenAPI coverage.** OpenAPI now describes configured bulk PATCH/DELETE operations, query controls, relations, and enabled metadata endpoints.
- [x] **Refresh vulnerable production dependencies.** Patched compatible Mongoose, Express, `path-to-regexp`, and Joi versions are pinned by supported ranges and lockfile overrides; CI requires a clean high-severity production audit.
- [x] **Add regression coverage.** Tests cover MongoDB-operator rejection in bulk filters, bulk lifecycle and soft-delete behavior, projection permission boundaries, and generated OpenAPI extensions.

## Adoption and API follow-ups — delivered

These product gaps were identified during an external package-page review and are now implemented.

- [x] **Use bounded list responses by default.** List routes now return a bounded first page by default (`20`, capped by `maxLimit`); applications can set `get.defaultLimit`.
- [x] **Modernize the default update contract.** New documentation and starter configurations use `legacyPostUpdate: false`; compatibility remains explicitly available for existing clients.
- [x] **Add per-operation middleware.** `operationMiddleWares` supports separate middleware arrays for generated operations alongside resource-wide `middleWares`.
- [x] **Support safe alternate-key lookup routes.** `lookup: { key, path? }` adds opt-in read and delete routes such as `/users/by-email/:value`, with existing authorization, scopes, and tenant rules.
- [x] **Offer a Zod integration path.** Validation accepts Joi schemas and Zod-compatible schemas exposing `safeParse`; Zod object schemas are made partial automatically for PATCH.
- [x] **Improve package discoverability.** The package homepage now points to the GitHub repository and the published package includes TypeScript declarations.

## V3 launch scope — delivered

- [x] **Add PUT replacement semantics.** Keep `POST` compatibility updates opt-in, retain PATCH for partial updates, and offer an explicit replacement route only with clear validation rules.
- [x] **Add configurable soft deletes.** Support `deletedAt` and `deletedBy` for models that require recoverability.
- [x] **Expand query expressiveness safely.** Add narrowly scoped operators and logical groups without weakening the current allow-lists.
- [x] **Increase integration coverage.** Add population, middleware-order, custom request-ID, and race-condition cases to the existing route matrix.
- [x] **Generate OpenAPI.** Produce an OpenAPI 3.1 document from the Maggie configuration, including schemas, routes, query parameters, and error responses.

## High-value post-launch features — delivered

- [x] **Policy hooks.** Add `beforeCreate`, `beforeUpdate`, `beforeDelete`, `afterCreate`, `afterUpdate`, and `afterDelete` hooks. Hooks should receive the request, model, input, and result and support async work.
- [x] **Authorization hooks.** Allow per-route `authorize` handlers and query scopes so an application can enforce rules such as “a user may only see their own records.”
- [x] **Field-level permissions.** Support separate readable, writable, filterable, sortable, and searchable field allow-lists by operation.
- [x] **Advanced filtering.** Add a typed operator allow-list (`eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `exists`, `regex`) and configurable logical groups. Keep the default deliberately restrictive.
- [x] **Cursor pagination.** Add cursor-based pagination alongside the existing offset pagination for large collections and live data feeds.
- [x] **Projection and population controls.** Permit safe client-selected fields and controlled population through allow-lists; add population depth and result-size limits.
- [x] **Schema-derived validation.** Offer optional generation of Joi validation from a Mongoose schema, while retaining manually supplied schemas for complex rules.
- [x] **Bulk operation improvements.** Support atomic/non-atomic modes, ordered/unordered writes, per-item errors, maximum batch size, and bulk update/delete operations.
- [x] **Lifecycle metadata.** Provide optional automatic `createdBy`, `updatedBy`, timestamps, request IDs, and audit logs through a reusable plugin or configuration preset.

## Differentiating features — delivered

These capabilities differentiate the library from a simple CRUD generator.

- [x] **OpenAPI generation.** Produce an OpenAPI 3.1 document from the Maggie configuration, including schemas, routes, query parameters, and error responses. This is the strongest candidate for a visible v3 feature.
- [x] **Admin-ready metadata endpoint.** Expose an opt-in, protected metadata endpoint describing each resource’s fields, operations, filters, sorting, pagination, and relations.
- [x] **Declarative relations.** Add relation configuration for population, nested resource routes, and safe relation-aware filtering.
- [x] **Multi-tenancy.** Offer a first-class tenant resolver that automatically scopes all reads and writes to a tenant field.
- [x] **Change events.** Add optional event-emitter callbacks for create, update, delete, and bulk operations.
- [x] **Caching hooks.** Provide cache-key and invalidation hooks for list and by-id reads without tying the package to a specific cache provider.

## Release sequence — completed

- [x] Stabilize the v2 contract with integration tests and a published [behavior matrix](v2-behavior-matrix.md).
- [x] Build the V3 launch scope, retaining a documented [v2 compatibility mode](v2-migration.md#moving-from-v2-to-v3) where practical.
- [x] Launch **OpenAPI generation** as the headline feature, alongside secure query controls and standard CRUD verbs.
- [x] Follow with authorization/scoping and bulk-operation improvements based on adopters’ needs.

## Implementation decisions — resolved

- [x] **Compatibility:** v3 uses PATCH for updates by default. Applications with older clients can explicitly enable `legacyPostUpdate` per resource during migration.
- [x] **Validation:** Joi remains the primary API and `joiSchemaFromMongoose` supplies optional schema-derived Joi validation. Zod-compatible schemas are supported through the shared validation adapter.
- [x] **Security posture:** all client-controlled fields are deny-by-default. Unknown filter operators/fields and requested search fields are rejected with `400 QUERY_ERROR` unless the relevant allow-list explicitly permits them. `strict: false` is the explicit compatibility escape hatch for filters.
- [x] **OpenAPI packaging:** OpenAPI generation remains in the core package as `createOpenApiDocument`, keeping the API specification exactly aligned with router configuration without an additional versioned dependency.
- [x] **Runtime support:** support Node.js `>=20 <25` and Mongoose `>=8.24.4 <9` (with Express `>=5.2.1 <6` and Joi `>=17.13.8 <18`). CI verifies Node 20, 22, and 24 against both the minimum supported and latest Mongoose 8 releases.
