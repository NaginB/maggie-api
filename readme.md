# maggie-api

`maggie-api` mounts conventional CRUD routes for Mongoose models in an Express application. Configure each model once to opt into body validation, unique-key checks, field selection, population, search, filtering, sorting, and pagination.

## Installation

```bash
npm install maggie-api express mongoose joi
```

`express` 5, `mongoose` 8, and `joi` 17 are peer dependencies; install them in the application that uses Maggie. Your application must connect Mongoose to MongoDB before handling requests. Node.js 20 or later is required.

## Quick start

```ts
import express from "express";
import mongoose, { Schema } from "mongoose";
import Joi from "joi";
import { createMaggie } from "maggie-api";

const app = express();
app.use(express.json());

const userSchema = new Schema({
  firstName: { type: String, required: true },
  lastName: { type: String, required: true },
  email: { type: String, required: true },
});
const User = mongoose.model("User", userSchema);

const api = createMaggie({
  prefix: "/api/v1",
  models: [
    {
      model: User,
      path: "users",
      primaryKey: "email",
      validationSchema: Joi.object({
        _id: Joi.string(),
        firstName: Joi.string().required(),
        lastName: Joi.string().required(),
        email: Joi.string().email().required(),
      }),
      settings: {
        legacyPostUpdate: false,
        maxBulkSize: 100,
        get: {
          keys: ["_id", "firstName", "lastName", "email"],
          search: { allowedFields: ["firstName", "lastName", "email"] },
          filter: { strict: true, fields: { email: { type: "string" } } },
          sort: { allowedFields: ["firstName", "lastName"] },
          maxLimit: 100,
        },
        getById: { keys: ["_id", "firstName", "lastName", "email"] },
      },
    },
  ],
});

app.use(api);
await mongoose.connect(process.env.MONGODB_URI!);
app.listen(3000);
```

## Generated routes

For a model configured with `prefix: "/api/v1"` and `path: "users"`:

| Method   | Route                | Behavior                                                                                      |
| -------- | -------------------- | --------------------------------------------------------------------------------------------- |
| `POST`   | `/api/v1/users`      | Creates a document. Legacy `_id` updates require `legacyPostUpdate: true` (the default).      |
| `POST`   | `/api/v1/users/bulk` | Inserts a non-empty array of documents.                                                       |
| `PATCH`  | `/api/v1/users/:id`  | Partially updates one document.                                                               |
| `PUT`    | `/api/v1/users/:id`  | Replaces one document; uses the full create schema unless a replacement schema is configured. |
| `GET`    | `/api/v1/users`      | Returns all matching documents.                                                               |
| `GET`    | `/api/v1/users/:id`  | Returns one document by MongoDB id.                                                           |
| `DELETE` | `/api/v1/users/:id`  | Deletes one document by MongoDB id.                                                           |

All routes receive `middleWares`, when configured. `validationSchema` is applied to the single-document and bulk `POST` routes. PATCH uses `updateValidationSchema` when supplied, otherwise an optionalized form of `validationSchema`. Joi validation converts values and strips unknown fields.

## List query parameters

`GET` list routes support the following parameters.

| Parameter          | Example                                                        | Notes                                                                                       |
| ------------------ | -------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| `search`           | `?search=ada`                                                  | Literal, length-limited search; requires a configured searchable field.                     |
| `searchFields`     | `?searchFields=firstName,lastName`                             | Restricted to `search.allowedFields` when provided.                                         |
| `caseSensitive`    | `?caseSensitive=true`                                          | Search is case-insensitive by default.                                                      |
| `filter`           | `?filter[email]=ada@example.com`                               | Requires `filter.fields` or `filter.allowedFields`; strict mode rejects unknown fields.     |
| Range filter       | `?filter[age][gte]=18`                                         | Requires `age` to permit `gte`; supported range operators are `gte`, `lte`, `gt`, and `lt`. |
| Array filter       | `?filter[email][]=a@example.com&filter[email][]=b@example.com` | Produces `$in` when the field permits `in`.                                                 |
| `sort`             | `?sort=-createdAt,lastName`                                    | Fields must be in `settings.get.sort.allowedFields`.                                        |
| `limit` and `page` | `?limit=20&page=2`                                             | Positive integers; `limit` is capped by `maxLimit`.                                         |

When pagination is active, the response data contains the configured `responseKey` (or the pluralized model name) and `pagination` metadata.

## Configuration

See [the configuration reference](docs/configuration.md) for the supported options and [the API behavior reference](docs/api-behavior.md) for response and edge-case details. Contributors should start with [the development guide](docs/development.md).

## Notes

- `getKeys` and `getByIdKeys` remain supported for compatibility, but prefer `settings.get.keys` and `settings.getById.keys`.
- `primaryKey` performs an application-level duplicate check. Add a unique index to the Mongoose schema as the database-level guarantee; Mongo duplicate-key errors return `409 CONFLICT`.
- Errors use a consistent envelope with `data: null`, a stable `code`, and optional structured `details` for validation failures.
- `POST` updates remain compatible by default. Set `settings.legacyPostUpdate: false` to require `PATCH /:id`.
- Set `settings.softDelete` to retain deleted documents. Soft-deleted records are hidden from generated reads by default.
- For a full breaking-change summary, see the [2.0 migration note](docs/v1-migration.md).

## License

Apache-2.0. See [license](license).
