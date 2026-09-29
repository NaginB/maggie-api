# Security guide

Maggie provides controls; the application chooses the policy. Treat each generated resource as an externally reachable API surface and make its read and write rules explicit.

## Start with a restrictive resource

```ts
settings: {
  legacyPostUpdate: false,
  permissions: {
    readable: ["_id", "name", "email", "createdAt"],
    writable: ["name"],
    filterable: ["name"],
    sortable: ["name", "createdAt"],
    searchable: ["name"],
  },
  get: {
    keys: ["_id", "name", "email", "createdAt"],
    maxLimit: 50,
    search: { allowedFields: ["name"] },
    filter: { fields: { name: { type: "string", operators: ["eq"] } } },
    sort: { allowedFields: ["name", "createdAt"] },
  },
  getById: { keys: ["_id", "name", "email", "createdAt"] },
}
```

`permissions` provides global resource-level field rules. The matching `get` configuration controls the syntax and types accepted on list endpoints. Use both when clients can query a resource.

## Require authorization and scope records

An authorizer decides whether a route may run. A query scope decides which records it may see or mutate. Use a scope for ownership checks instead of fetching a document later and comparing it in application code.

```ts
settings: {
  authorize: {
    read: (req) => Boolean(req.user),
    create: (req) => req.user?.role === "editor",
    update: (req) => req.user?.role === "editor",
    replace: (req) => req.user?.role === "editor",
    delete: (req) => req.user?.role === "admin",
  },
  queryScope: (req) => ({ ownerId: req.user.id }),
}
```

An authorizer returning `false` returns `403 FORBIDDEN`. A scoped record that does not exist for the caller returns `404 NOT_FOUND`; that prevents disclosure of its existence.

## Isolate tenants

For multi-tenant applications, a tenant resolver is applied to reads and writes and fills the field during creation. Do not accept the tenant identity from a client-controlled body.

```ts
settings: {
  tenant: {
    field: "tenantId",
    resolve: (req) => req.user?.tenantId,
  },
}
```

Maggie rejects missing tenant values by default and rejects attempts to change the tenant field after creation.

## Limit expressive queries

Filtering, sorting, search fields, client projection, and client population are opt-in. Keep these boundaries small:

- Set a low `maxLimit` and use cursor pagination for large collections.
- Define typed `filter.fields`, not just string field names.
- Enable `regex` only for trusted clients and only with `allowRegex: true` on that field.
- Enable logical `$and` and `$or` groups only when clients need them.
- Limit `clientProjection.maxFields`, `clientPopulate.maxPaths`, and `clientPopulate.maxDepth`.

Unknown query fields and operators are rejected by default with `400 QUERY_ERROR`. `strict: false` is a compatibility option, not a general safety setting.

## Validate and protect writes

Use Joi to validate HTTP bodies and Mongoose schema constraints for storage integrity. `primaryKey` performs a pre-flight check, but only a Mongoose unique index protects against concurrent writes.

```ts
const schema = new Schema({
  email: { type: String, required: true, unique: true },
});

const input = Joi.object({
  email: Joi.string().email().required(),
});
```

Use `updateValidationSchema` when a partial update needs rules different from an optionalized create schema, and `replaceValidationSchema` when PUT has its own full-document contract.

## Protect metadata and operational features

- Metadata is intentionally opt-in and requires `metadata.authorize`; expose it only to trusted administrators.
- Bulk update and bulk delete routes do not exist until their `settings.bulk` flags are enabled. Authorize the `bulk` operation separately.
- Cache keys must include every isolation dimension, such as tenant and authenticated user. Invalidate after mutations.
- Hooks and events receive request context. Avoid placing secrets or raw credentials in audit logs.
- Soft deletion hides documents from generated reads; it is not a retention policy or access-control substitute.

## Deployment checklist

- Authenticate before mounting public resources, or use per-resource `authorize` callbacks.
- Put a unique index behind each business-unique `primaryKey`.
- Configure response selection for list and by-id reads.
- Set a bounded list limit and only enable required query features.
- Send or accept `x-request-id` and connect the configured logger to your observability platform.
- Run `npm run check` before publishing an application integration.
