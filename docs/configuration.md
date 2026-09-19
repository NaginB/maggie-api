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
  version: "2.0.0",
});
```

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

Filters remain allow-listed per field. In addition to `eq`, `in`, and range operators, v2 supports `ne`, `nin`, and `exists`. `regex` is available only when it appears in a field's `operators` list and `allowRegex: true` is set for that field. Logical groups are disabled by default; explicitly configure `logicalOperators: ["or", "and"]` and use `filter[$or][0][field]=value` or `filter[$and][0][field]=value`.

## Cursor pagination

Configure a stable cursor field to opt in. Request the first page with `?cursor=start&limit=20`, then pass the returned `cursorPagination.nextCursor` as `cursor` for the next page. Cursor tokens are opaque and use `_id` as a tie-breaker so repeated field values do not skip records.

```ts
get: {
  cursorPagination: { field: "createdAt", type: "date", direction: "desc", maxLimit: 50 },
}
```
