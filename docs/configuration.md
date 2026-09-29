# Configuration reference

`createMaggie(payload)` creates an Express router. The router owns only the generated resource routes: mount JSON parsing, authentication, and any application middleware in Express as usual.

```ts
const api = createMaggie({
  prefix: "/api/v3",
  models: [/* model configurations */],
  requestId: (req) => req.header("x-correlation-id") || undefined,
  logger: { error: (entry) => logger.error(entry) },
  metadata: { authorize: (req) => req.user?.role === "admin" },
});
```

| Payload option | Required | Description                                                                       |
| -------------- | -------- | --------------------------------------------------------------------------------- |
| `prefix`       | Yes      | Prefix added before every configured resource path.                               |
| `models`       | Yes      | One or more `MaggieModelPayload` resource configurations.                         |
| `requestId`    | No       | Returns a request identifier. Falls back to incoming `x-request-id`, then a UUID. |
| `logger`       | No       | Receives structured unexpected-error events and lifecycle audit messages.         |
| `metadata`     | No       | Enables a protected resource-description endpoint.                                |

## Model configuration

| Option                    | Description                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| `model`, `path`           | Required Mongoose model and route segment.                                                |
| `validationSchema`        | Joi schema for create and bulk. PATCH uses an optionalized form of it.                    |
| `updateValidationSchema`  | Optional Joi schema specifically for PATCH; it works independently of `validationSchema`. |
| `replaceValidationSchema` | Optional Joi schema for PUT replacement; otherwise PUT uses `validationSchema`.           |
| `primaryKey`              | Pre-flight duplicate check; pair it with a Mongoose unique index.                         |
| `middleWares`             | Express middleware for every generated route.                                             |
| `getKeys`, `getByIdKeys`  | Deprecated selection aliases. `settings` takes precedence.                                |

```ts
settings: {
  responseKey: "members",
  legacyPostUpdate: false,
  deleteStatus: 204,
  maxBulkSize: 50,
  get: {
    keys: ["_id", "name", "age"],
    maxLimit: 50,
    search: { allowedFields: ["name"], maxLength: 80, allowRegex: false },
    filter: {
      strict: true,
      fields: {
        age: { type: "number", operators: ["eq", "gte", "lte"] },
        active: { type: "boolean", operators: ["eq"] },
      },
    },
    sort: { allowedFields: ["name", "age"] },
  },
  getById: { keys: ["_id", "name"] },
}
```

`filter.allowedFields` remains supported for simple string filters. Prefer `filter.fields` for explicit value types and operator restrictions. Supported types are `string`, `number`, `boolean`, `date`, and `objectId`; supported operators are `eq`, `in`, `gte`, `lte`, `gt`, and `lt`. Filters reject unknown fields and operators by default; set `strict: false` only for a deliberate compatibility policy.

All public configuration and response interfaces are exported from the package root.

## Read controls

`settings.get` configures list routes and `settings.getById` configures by-id reads.

| Option             | Applies to  | Description                                                           |
| ------------------ | ----------- | --------------------------------------------------------------------- |
| `keys`             | List, by-id | Mongoose selection fields returned to the client.                     |
| `populate`         | List, by-id | Server-controlled population paths.                                   |
| `maxLimit`         | List        | Maximum offset or cursor page size; defaults to `100`.                |
| `search`           | List        | Allowed fields, maximum term length, and optional regex behavior.     |
| `filter`           | List        | Typed field/operator allow-list and logical group policy.             |
| `sort`             | List        | Allowed sort fields and strictness policy.                            |
| `cursorPagination` | List        | Stable cursor field, type, direction, and maximum page size.          |
| `clientProjection` | List        | Client-selectable field allow-list and field-count limit.             |
| `clientPopulate`   | List        | Client-selectable population allow-list, path limit, and depth limit. |

`keys` controls the selected data. `permissions.readable` is an additional resource-wide boundary; when configured, it takes precedence over the read-specific selection. See the [security guide](security.md) before enabling client projection or population.

## Write controls

| Option                 | Description                                                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `legacyPostUpdate`     | Allows a `POST /resource` body containing `_id` to behave as an update. Defaults to disabled; enable it only for older clients. |
| `deleteStatus`         | Uses `200` with an envelope by default; set `204` for no-content deletion.                                                      |
| `maxBulkSize`          | Maximum documents accepted by `POST /bulk`; defaults to `100`.                                                                  |
| `softDelete`           | Stores a deletion timestamp and optional actor instead of removing a document.                                                  |
| `permissions.writable` | Rejects incoming write fields outside this list.                                                                                |
| `lifecycle`            | Fills actor/timestamp fields and optionally writes lifecycle audit messages through `logger.info`.                              |
| `hooks`                | Runs asynchronous work before or after create, update, delete, and bulk operations.                                             |
| `events`               | Publishes completed mutation events to callbacks or an EventEmitter-style adapter.                                              |

Hooks receive `{ operation, req, model, input, document }`. `beforeCreate`, `afterCreate`, `beforeUpdate`, `afterUpdate`, `beforeDelete`, `afterDelete`, `beforeBulk`, and `afterBulk` are supported. `after*` hooks and events receive the completed document or mutation result.

```ts
settings: {
  permissions: { writable: ["name", "role"] },
  lifecycle: {
    createdBy: "createdBy",
    updatedBy: "updatedBy",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    getActor: (req) => req.user?.id,
    audit: true,
  },
  hooks: {
    afterCreate: async ({ document }) => indexDocument(document),
  },
}
```

## OpenAPI

`createOpenApiDocument(payload, options?)` creates an OpenAPI 3.1 document from the same payload passed to `createMaggie`. It includes generated paths, standard query parameters, Joi-derived request schemas when available, and shared error responses.

```ts
import { createOpenApiDocument } from "maggie-api";

const openapi = createOpenApiDocument(maggiePayload, {
  title: "Members API",
  version: "3.0.0",
});
```

## Metadata endpoint

Metadata is opt-in and requires an authorizer, preventing accidental exposure of model structure. It is served at `${prefix}/_meta` by default and reports fields, available operations, query controls, pagination, and declared relations.

```ts
createMaggie({
  prefix: "/api",
  metadata: { authorize: (req) => req.user?.role === "admin" },
  models,
});
```

## Relations

Declare a related Mongoose model to expose a read-only nested list. The related list is always constrained by `foreignField`; its optional `filter` is parsed with the same allow-list protections as a normal list route.

```ts
settings: {
  relations: [{
    path: "comments",
    model: Comment,
    foreignField: "postId",
    filter: { strict: true, fields: { published: { type: "boolean" } } },
    populate: [{ path: "author", select: ["name"] }],
  }],
}
// GET /api/posts/:id/comments?filter[published]=true
```

## Tenancy, events, and caching

`tenant` resolves a value for every request. Maggie writes it on creates, rejects tenant-field changes, and scopes list, by-id, update, replace, delete, and bulk mutations. A missing value is rejected unless `required: false` is set.

```ts
settings: {
  tenant: { field: "tenantId", resolve: (req) => req.user?.tenantId },
  events: {
    onChange: async ({ operation, document }) => audit(operation, document),
    // An EventEmitter-style `emit(operation, event)` is also supported.
  },
  cache: {
    key: ({ operation, req, id }) => `${operation}:${req.user.id}:${id ?? req.originalUrl}`,
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value),
    invalidate: () => cache.clear(),
  },
}
```

The cache integration is intentionally provider-neutral. Reads are cached only when `key` returns a key; successful mutations call `invalidate`.

## Authorization, scopes, and bulk writes

`authorize` runs before a generated operation and returns `false` for a `403 FORBIDDEN` response. `queryScope` is combined with list, by-id, update, replace, delete, and bulk mutation queries, so it is suitable for row-level ownership rules.

```ts
settings: {
  authorize: {
    read: (req) => req.user?.canRead === true,
    bulk: (req) => req.user?.role === "admin",
  },
  queryScope: (req) => ({ ownerId: req.user.id }),
  bulk: { allowUpdate: true, allowDelete: true, ordered: false, atomic: true },
}
```

`POST /bulk` always creates documents. `PATCH /bulk` accepts `{ filter, update }` and validates `update` with `updateValidationSchema` or the optionalized create schema. `DELETE /bulk` accepts `{ filter }`; the latter two are generated only when their corresponding `bulk` flag is enabled. Their filters use the same typed field/operator allow-list as list routes, and all bulk mutations are scoped and authorized before they reach MongoDB. With `softDelete`, bulk delete marks matching active documents as deleted rather than removing them.

## Soft deletes

Set `softDelete` to retain deleted documents while excluding them from generated list and by-id reads. `deletedAt` defaults to `"deletedAt"`; `deletedBy` and `getDeletedBy` are optional.

```ts
settings: {
  softDelete: {
    deletedAt: "deletedAt",
    deletedBy: "deletedBy",
    getDeletedBy: (req) => req.user.id,
  },
}
```

## Additional filter operators

Filters remain allow-listed per field. In addition to `eq`, `in`, and range operators, v3 supports `ne`, `nin`, and `exists`. `regex` is available only when it appears in a field's `operators` list and `allowRegex: true` is set for that field. Logical groups are disabled by default; explicitly configure `logicalOperators: ["or", "and"]` and use `filter[$or][0][field]=value` or `filter[$and][0][field]=value`.

## Cursor pagination

Configure a stable cursor field to opt in. Request the first page with `?cursor=start&limit=20`, then pass the returned `cursorPagination.nextCursor` as `cursor` for the next page. Cursor tokens are opaque and use `_id` as a tie-breaker so repeated field values do not skip records.

```ts
get: {
  cursorPagination: { field: "createdAt", type: "date", direction: "desc", maxLimit: 50 },
}
```

## Client projection and population

Server-defined `keys` and `populate` are always safe defaults. To let a client select a limited subset, configure it explicitly:

```ts
settings: {
  get: {
    clientProjection: { allowedFields: ["name", "email", "avatar"], maxFields: 3 },
    clientPopulate: { allowedPaths: ["team", "manager"], maxPaths: 1, maxDepth: 1 },
  },
}
```

Clients may then use `?fields=name,email` and `?populate=team`. Requests that exceed the configured path, field, or nesting limits fail with `400 QUERY_ERROR`.
