# Version 3 roadmap

This roadmap focuses on making `maggie-api` safer to expose publicly, easier to customize, and more useful for production applications. Items are ordered by recommended delivery priority rather than implementation difficulty.

## V3 launch scope

- [x] **Add PUT replacement semantics.** Keep `POST` compatibility updates opt-in, retain PATCH for partial updates, and offer an explicit replacement route only with clear validation rules.
- [x] **Add configurable soft deletes.** Support `deletedAt` and `deletedBy` for models that require recoverability.
- [x] **Expand query expressiveness safely.** Add narrowly scoped operators and logical groups without weakening the current allow-lists.
- [x] **Increase integration coverage.** Add population, middleware-order, custom request-ID, and race-condition cases to the existing route matrix.
- [x] **Generate OpenAPI.** Produce an OpenAPI 3.1 document from the Maggie configuration, including schemas, routes, query parameters, and error responses.

## High-value post-launch features

- [x] **Policy hooks.** Add `beforeCreate`, `beforeUpdate`, `beforeDelete`, `afterCreate`, `afterUpdate`, and `afterDelete` hooks. Hooks should receive the request, model, input, and result and support async work.
- [x] **Authorization hooks.** Allow per-route `authorize` handlers and query scopes so an application can enforce rules such as “a user may only see their own records.”
- [x] **Field-level permissions.** Support separate readable, writable, filterable, sortable, and searchable field allow-lists by operation.
- [x] **Advanced filtering.** Add a typed operator allow-list (`eq`, `ne`, `in`, `nin`, `gt`, `gte`, `lt`, `lte`, `exists`, `regex`) and configurable logical groups. Keep the default deliberately restrictive.
- [x] **Cursor pagination.** Add cursor-based pagination alongside the existing offset pagination for large collections and live data feeds.
- [x] **Projection and population controls.** Permit safe client-selected fields and controlled population through allow-lists; add population depth and result-size limits.
- [x] **Schema-derived validation.** Offer optional generation of Joi or Zod validation from a Mongoose schema, while retaining manually supplied schemas for complex rules.
- [x] **Bulk operation improvements.** Support atomic/non-atomic modes, ordered/unordered writes, per-item errors, maximum batch size, and bulk update/delete operations.
- [x] **Lifecycle metadata.** Provide optional automatic `createdBy`, `updatedBy`, timestamps, request IDs, and audit logs through a reusable plugin or configuration preset.

## Differentiating features to consider

These features can make the library more compelling than a simple CRUD generator. Select one or two rather than launching all of them at once.

- [x] **OpenAPI generation.** Produce an OpenAPI 3.1 document from the Maggie configuration, including schemas, routes, query parameters, and error responses. This is the strongest candidate for a visible v3 feature.
- [x] **Admin-ready metadata endpoint.** Expose an opt-in, protected metadata endpoint describing each resource’s fields, operations, filters, sorting, pagination, and relations.
- [x] **Declarative relations.** Add relation configuration for population, nested resource routes, and safe relation-aware filtering.
- [x] **Multi-tenancy.** Offer a first-class tenant resolver that automatically scopes all reads and writes to a tenant field.
- [x] **Change events.** Add optional event-emitter callbacks for create, update, delete, and bulk operations.
- [x] **Caching hooks.** Provide cache-key and invalidation hooks for list and by-id reads without tying the package to a specific cache provider.

## Recommended release sequence

- [x] Stabilize the v2 contract with integration tests and a published [behavior matrix](v2-behavior-matrix.md).
- [x] Build the V3 launch scope, retaining a documented [v2 compatibility mode](v2-migration.md#moving-from-v2-to-v3) where practical.
- [x] Launch **OpenAPI generation** as the headline feature, alongside secure query controls and standard CRUD verbs.
- [x] Follow with authorization/scoping and bulk-operation improvements based on adopters’ needs.

## Decisions to make before implementation

- [x] **Compatibility:** v3 retains the v2 route and response contract. `legacyPostUpdate` defaults to enabled; applications can disable it per resource when clients have moved to PATCH. This makes v3 an additive major release rather than a forced route migration.
- [x] **Validation:** Joi is the sole validation runtime in the core package. Manual Joi schemas remain the primary API, and `joiSchemaFromMongoose` supplies optional schema-derived Joi validation. Zod adapters are deferred until there is a separate package and a compatibility commitment.
- [x] **Security posture:** all client-controlled fields are deny-by-default. Unknown filter operators/fields and requested search fields are rejected with `400 QUERY_ERROR` unless the relevant allow-list explicitly permits them. `strict: false` is the explicit compatibility escape hatch for filters.
- [x] **OpenAPI packaging:** OpenAPI generation remains in the core package as `createOpenApiDocument`, keeping the API specification exactly aligned with router configuration without an additional versioned dependency.
- [x] **Runtime support:** support Node.js `>=20 <25` and Mongoose `>=8 <9` (with Express `>=5 <6` and Joi `>=17 <18`). CI verifies Node 20, 22, and 24 against both the minimum supported and latest Mongoose 8 releases.
