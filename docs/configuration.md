# Configuration reference

`createMaggie({ prefix, models, requestId?, logger? })` creates one router. `requestId` can return an application request id; otherwise Maggie uses the incoming `x-request-id` or generates a UUID. `logger` receives structured unexpected-error events and replaces direct console logging.

## Model configuration

| Option                   | Description                                                                               |
| ------------------------ | ----------------------------------------------------------------------------------------- |
| `model`, `path`          | Required Mongoose model and route segment.                                                |
| `validationSchema`       | Joi schema for create and bulk. PATCH uses an optionalized form of it.                    |
| `updateValidationSchema` | Optional Joi schema specifically for PATCH; it works independently of `validationSchema`. |
| `primaryKey`             | Pre-flight duplicate check; pair it with a Mongoose unique index.                         |
| `middleWares`            | Express middleware for every generated route.                                             |
| `getKeys`, `getByIdKeys` | Deprecated selection aliases. `settings` takes precedence.                                |

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
