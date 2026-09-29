# Every Maggie feature, simply explained

This is the friendly guide. You do not need every feature. Begin with a model, validation, and safe read fields. Add one feature at a time when your app needs it.

## The one idea to remember

```ts
{ model: User, path: "users", settings: { /* your rules */ } }
```

This creates an API at `/api/users`. The `settings` are the rules for that API: who can use it, which records they can see, and which fields they can read or change.

## 1. The basic routes

| You want to… | Request             | What it does                       |
| ------------ | ------------------- | ---------------------------------- |
| Create one   | `POST /users`       | Makes a new user.                  |
| List         | `GET /users`        | Shows users using your list rules. |
| Get one      | `GET /users/:id`    | Finds one user by MongoDB id.      |
| Change part  | `PATCH /users/:id`  | Changes only provided fields.      |
| Replace all  | `PUT /users/:id`    | Replaces the full record.          |
| Delete       | `DELETE /users/:id` | Removes or soft-deletes a record.  |

Older APIs may send an `_id` in `POST /users` to update a record. New APIs should disable that older behavior:

```ts
settings: {
  legacyPostUpdate: false;
}
```

## 2. Check request data with Joi

Joi checks incoming data before it reaches MongoDB.

```ts
validationSchema: Joi.object({
  name: Joi.string().trim().min(1).required(),
  email: Joi.string().email().required(),
});
```

This checks create and bulk-create requests. PATCH uses the same fields as optional fields. Use a special schema when PATCH or PUT needs different rules:

```ts
updateValidationSchema: Joi.object({ name: Joi.string().min(2).required() }),
replaceValidationSchema: Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
}),
```

Maggie removes unknown fields and lets Joi convert simple values. `joiSchemaFromMongoose(schema)` can make a basic Joi schema from Mongoose, but write Joi yourself for important business rules.

## 3. Choose visible and writable fields

Use this to avoid accidentally returning password hashes, internal notes, or admin fields.

```ts
settings: {
  get: { keys: ["_id", "name", "email"] },
  getById: { keys: ["_id", "name", "email"] },
  permissions: {
    readable: ["_id", "name", "email"],
    writable: ["name"],
  },
}
```

Here clients may see `email`, but can only change `name`. `permissions.filterable`, `permissions.sortable`, and `permissions.searchable` set the same kind of safety boundary for list queries.

## 4. Search, filter, sort, and use pages

Put list rules inside `settings.get`. Nothing powerful is turned on just because it exists.

```ts
settings: {
  get: {
    maxLimit: 50,
    search: { allowedFields: ["name", "email"] },
    filter: {
      fields: {
        age: { type: "number", operators: ["eq", "gte", "lte"] },
        active: { type: "boolean", operators: ["eq"] },
      },
    },
    sort: { allowedFields: ["name", "age"] },
  },
}
```

| Feature          | Example                                         | Meaning                             |
| ---------------- | ----------------------------------------------- | ----------------------------------- |
| Search           | `?search=ada`                                   | Finds “ada” in allowed text fields. |
| Search one field | `?search=ada&searchFields=name`                 | Searches only `name`.               |
| Exact filter     | `?filter[active]=true`                          | Finds active users.                 |
| Number range     | `?filter[age][gte]=18`                          | Finds users age 18 or older.        |
| Several values   | `?filter[status][]=new&filter[status][]=active` | Matches either status.              |
| Sort             | `?sort=-age,name`                               | Age high-to-low, then name.         |
| Page number      | `?limit=20&page=2`                              | Second group of 20 results.         |

Extra filter operators are `ne`, `nin`, `exists`, `gt`, `gte`, `lt`, `lte`, and `regex`. Turn on only operators you need. `regex` and logical `$and` / `$or` groups are off by default because they are powerful.

## 5. Use cursor pages for feeds

Normal page numbers can move when new records appear. A cursor is a bookmark, which is better for large or changing lists.

```ts
settings: {
  get: {
    cursorPagination: {
      field: "createdAt",
      type: "date",
      direction: "desc",
      maxLimit: 50,
    },
  },
}
```

Request `GET /users?cursor=start&limit=20`. Copy the returned `cursorPagination.nextCursor` into the next request. Include the cursor field in the server-side selected fields so Maggie can make the next bookmark.

## 6. Let a client pick a small safe subset

Usually the server should choose fields and relations. For trusted clients, provide a short menu:

```ts
settings: {
  get: {
    clientProjection: { allowedFields: ["name", "email", "avatar"], maxFields: 3 },
    clientPopulate: { allowedPaths: ["team"], maxPaths: 1, maxDepth: 1 },
  },
}
```

The client may use `?fields=name,avatar` or `?populate=team`. Maggie refuses fields outside `permissions.readable` and rejects paths, depth, or counts above your limits.

## 7. Join related records

Population replaces an id with a related document. A nested relation creates a read-only child list.

```ts
settings: {
  get: { populate: [{ path: "team", select: ["name"] }] },
  relations: [{
    path: "comments",
    model: Comment,
    foreignField: "postId",
    filter: { fields: { published: { type: "boolean" } } },
  }],
}
```

This populates a post’s team and creates `GET /posts/:id/comments`. The nested route always adds `postId = :id`, so it cannot return another post’s comments.

## 8. Decide who can call each route

`authorize` answers, “May this person do this action?” Return `false` to send `403 FORBIDDEN`.

```ts
settings: {
  authorize: {
    read: (req) => Boolean(req.user),
    create: (req) => req.user?.role === "editor",
    delete: (req) => req.user?.role === "admin",
    bulk: (req) => req.user?.role === "admin",
  },
}
```

The action names are `create`, `read`, `update`, `replace`, `delete`, and `bulk`.

## 9. Keep people inside their own data

`queryScope` adds a record rule to reads, updates, replacements, deletes, and bulk operations.

```ts
settings: {
  queryScope: (req) => ({ ownerId: req.user.id });
}
```

This means “only records owned by this user.” Other records behave as if they do not exist.

For a multi-company app, use `tenant` instead. Maggie fills the tenant field on creation, blocks users from changing it, and automatically uses it for generated reads and writes.

```ts
settings: {
  tenant: { field: "tenantId", resolve: (req) => req.user?.tenantId },
}
```

## 10. Keep deleted records without showing them

Soft delete marks a record deleted instead of permanently removing it.

```ts
settings: {
  softDelete: {
    deletedAt: "deletedAt",
    deletedBy: "deletedBy",
    getDeletedBy: (req) => req.user?.id,
  },
}
```

Generated list and by-id routes hide soft-deleted records. Bulk delete follows the same rule. Add these fields to your Mongoose schema.

## 11. Work with many records at once

```ts
settings: {
  maxBulkSize: 100,
  bulk: { allowUpdate: true, allowDelete: true, ordered: false, atomic: true },
}
```

| Request              | Body                 | What happens              |
| -------------------- | -------------------- | ------------------------- |
| `POST /users/bulk`   | Array of records     | Creates many records.     |
| `PATCH /users/bulk`  | `{ filter, update }` | Changes matching records. |
| `DELETE /users/bulk` | `{ filter }`         | Deletes matching records. |

`allowUpdate` and `allowDelete` must be true before the last two routes exist. Bulk filters use the same safe filter rules as lists. `ordered: false` lets MongoDB continue after a failed item. `atomic: true` uses a transaction, so MongoDB must support transactions.

## 12. Save who changed something and when

```ts
settings: {
  lifecycle: {
    createdBy: "createdBy",
    updatedBy: "updatedBy",
    createdAt: "createdAt",
    updatedAt: "updatedAt",
    getActor: (req) => req.user?.id,
    audit: true,
  },
}
```

Maggie adds these values to single and bulk creates and updates. `audit: true` sends simple audit messages to your `logger`.

## 13. Run your own code around actions

Hooks run before or after an action. Events tell another part of your app after success.

```ts
settings: {
  hooks: {
    beforeCreate: async ({ input }) => checkBusinessRule(input),
    afterCreate: async ({ document }) => addToSearchIndex(document),
  },
  events: {
    onChange: async ({ operation, document }) => audit(operation, document),
  },
}
```

Hooks exist before and after create, update, delete, and bulk work. Events support `onChange`, a callback per action, or an EventEmitter-style `emit` function.

## 14. Cache reads

Maggie does not force you to use any cache provider. Give it four small functions:

```ts
settings: {
  cache: {
    key: ({ operation, req, id }) => `${operation}:${req.user.id}:${id ?? req.originalUrl}`,
    get: (key) => cache.get(key),
    set: (key, value) => cache.set(key, value),
    invalidate: () => cache.clear(),
  },
}
```

Lists and by-id reads are cached when `key` returns a value. Successful writes call `invalidate`. Put the user and tenant in cache keys when responses differ by user or tenant.

## 15. Give admins an API map

The metadata endpoint describes your configured resources. It is private by design.

```ts
createMaggie({
  prefix: "/api",
  metadata: { authorize: (req) => req.user?.role === "admin" },
  models,
});
```

An admin calls `GET /api/_meta` to see resource paths, fields, enabled actions, query choices, and relations. Always use a real authorizer.

## 16. Make an OpenAPI document

OpenAPI is a machine-readable map for tools such as Swagger UI.

```ts
const document = createOpenApiDocument(maggiePayload, {
  title: "My API",
  version: "3.0.0",
});
```

It describes configured routes, schemas, list query controls, bulk actions, relations, metadata, and normal errors. Build it from the same payload used by `createMaggie`.

## 17. Understand responses, request ids, and logs

Success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User fetched successfully",
  "data": {}
}
```

Error:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error",
  "data": null,
  "code": "VALIDATION_ERROR"
}
```

Every generated route sends an `x-request-id` header. Send your own request id or provide `requestId: (req) => "..."`. Provide a `logger` to receive unexpected errors and optional lifecycle audit messages.

## A safe first setup

```ts
settings: {
  legacyPostUpdate: false,
  get: {
    keys: ["_id", "name", "email"],
    maxLimit: 50,
    search: { allowedFields: ["name"] },
    filter: { fields: { name: { type: "string", operators: ["eq"] } } },
    sort: { allowedFields: ["name"] },
  },
  getById: { keys: ["_id", "name", "email"] },
  permissions: {
    readable: ["_id", "name", "email"],
    writable: ["name"],
  },
}
```

When you need exact option names, use the [configuration reference](configuration.md). Before opening an API to untrusted clients, read the [security guide](security.md).
