# Configuration reference

`createMaggie` accepts one payload with a shared URL prefix and a list of model configurations.

```ts
createMaggie({
  prefix: "/api/v1",
  models: [/* model configurations */],
});
```

## Top-level options

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `prefix` | `string` | Yes | URL prefix placed before every model path. |
| `models` | array | Yes | Model route definitions. |

## Model configuration

| Option | Type | Required | Description |
| --- | --- | --- | --- |
| `model` | Mongoose `Model` | Yes | The Mongoose model that backs the routes. |
| `path` | `string` | Yes | Path segment appended to `prefix`. |
| `validationSchema` | Joi object schema | No | Validates both single and bulk POST bodies. |
| `primaryKey` | `string` | No | Field used for pre-write duplicate checks. |
| `middleWares` | Express handlers | No | Middleware run on every generated route. |
| `settings` | object | No | List and single-document read settings. |
| `getKeys` | `string[]` | No | Deprecated alias for `settings.get.keys`. |
| `getByIdKeys` | `string[]` | No | Deprecated alias for `settings.getById.keys`. |

## `settings`

```ts
settings: {
  get: {
    keys: ["_id", "name"],
    populate: [{ path: "owner", select: ["_id", "email"] }],
    search: { disabled: false, allowedFields: ["name"] },
    filter: { allowedFields: ["status", "price"] },
  },
  getById: {
    keys: ["_id", "name", "owner"],
    populate: [{ path: "owner", select: ["_id", "email"] }],
  },
}
```

`get.keys` and `getById.keys` are passed to Mongoose as a space-separated projection. Each population entry accepts `path`, optional `select`, and optional nested `populate` entries.

Search is enabled unless `search.disabled` is exactly `true`, but it only produces a query when there are usable fields: those in `search.allowedFields`, or fields supplied through `searchFields` when no allow-list is configured. Filtering is disabled by default because it requires `filter.allowedFields`.

### Compatibility precedence

When both forms are supplied, `settings.get.keys` takes precedence over `getKeys`, and `settings.getById.keys` takes precedence over `getByIdKeys`.
