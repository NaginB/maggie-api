# Configuration reference

`createMaggie({ prefix, models, requestId?, logger? })` creates one router. `requestId` can return an application request id; otherwise Maggie uses the incoming `x-request-id` or generates a UUID. `logger` receives structured unexpected-error events and replaces direct console logging.

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

`filter.allowedFields` remains supported for simple string filters. Prefer `filter.fields` for explicit value types and operator restrictions. Supported types are `string`, `number`, `boolean`, `date`, and `objectId`; supported operators are `eq`, `in`, `gte`, `lte`, `gt`, and `lt`.

All public configuration and response interfaces are exported from the package root.

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
