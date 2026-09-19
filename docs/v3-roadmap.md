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

- [ ] **OpenAPI generation.** Produce an OpenAPI 3.1 document from the Maggie configuration, including schemas, routes, query parameters, and error responses. This is the strongest candidate for a visible v3 feature.
- [ ] **Admin-ready metadata endpoint.** Expose optional, protected metadata describing each resource’s fields, permitted operations, filters, sorting, and pagination. An admin dashboard can use it to build tables and forms dynamically.
- [ ] **Declarative relations.** Add relation configuration for population, nested resource routes, and safe relation-aware filtering.
- [ ] **Multi-tenancy.** Offer a first-class tenant resolver that automatically scopes all reads and writes to a tenant field.
- [ ] **Change events.** Add optional webhooks or event-emitter callbacks for create, update, delete, and bulk operations.
- [ ] **Caching hooks.** Provide cache-key and invalidation hooks for list and by-id reads without tying the package to a specific cache provider.

## Recommended release sequence

1. Stabilize the v2 contract with integration tests and a published behavior matrix.
2. Build the V3 launch scope, retaining a documented v2 compatibility mode where practical.
3. Launch **OpenAPI generation** as the headline feature, alongside secure query controls and standard CRUD verbs.
4. Follow with authorization/scoping and bulk-operation improvements based on adopters’ needs.

## Decisions to make before implementation

- [ ] Decide whether v3 is a breaking major release or exposes a compatibility flag for v2 route behavior.
- [ ] Choose the validation direction: Joi-only, optional Joi/Zod adapters, or schema-derived validation as a separate package.
- [ ] Define the default security posture: strict allow-lists and rejected invalid queries are recommended for a public API library.
- [ ] Decide whether OpenAPI generation belongs in the core package or an `@maggie-api/openapi` companion package.
- [ ] Define a supported Node.js and Mongoose version range, then enforce it with CI.
