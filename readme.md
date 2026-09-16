# maggie-api

`maggie-api` mounts conventional CRUD routes for Mongoose models in an Express application. Configure each model once to opt into body validation, unique-key checks, field selection, population, search, filtering, sorting, and pagination.

## Installation

```bash
npm install maggie-api
```

The package includes `express`, `mongoose`, and `joi` as dependencies. Your application must connect Mongoose to MongoDB before handling requests.

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
        get: {
          keys: ["_id", "firstName", "lastName", "email"],
          search: { allowedFields: ["firstName", "lastName", "email"] },
          filter: { allowedFields: ["email"] },
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

| Method | Route | Behavior |
| --- | --- | --- |
| `POST` | `/api/v1/users` | Creates a document, or updates it when the body contains `_id`. |
| `POST` | `/api/v1/users/bulk` | Inserts a non-empty array of documents. |
| `GET` | `/api/v1/users` | Returns all matching documents. |
| `GET` | `/api/v1/users/:id` | Returns one document by MongoDB id. |
| `DELETE` | `/api/v1/users/:id` | Deletes one document by MongoDB id. |

All routes receive `middleWares`, when configured. `validationSchema` is applied to the single-document and bulk `POST` routes. Joi validation converts values and strips unknown fields.

## List query parameters

`GET` list routes support the following parameters.

| Parameter | Example | Notes |
| --- | --- | --- |
| `search` | `?search=ada` | Requires a configured searchable field. |
| `searchFields` | `?searchFields=firstName,lastName` | Restricted to `search.allowedFields` when provided. |
| `caseSensitive` | `?caseSensitive=true` | Search is case-insensitive by default. |
| `filter` | `?filter[email]=ada@example.com` | Only configured `filter.allowedFields` are used. |
| Range filter | `?filter[age][gte]=18` | Supports `gte`, `lte`, `gt`, and `lt`. |
| Array filter | `?filter[role][]=admin&filter[role][]=editor` | Produces an `$in` filter. |
| `sort` | `?sort=-createdAt,lastName` | Prefix a field with `-` for descending order. |
| `limit` and `page` | `?limit=20&page=2` | Pagination applies only when both are positive integers. |

When pagination is active, the response data contains the pluralized model-name key and `pagination` metadata.

## Configuration

See [the configuration reference](docs/configuration.md) for the supported options and [the API behavior reference](docs/api-behavior.md) for response and edge-case details. Contributors should start with [the development guide](docs/development.md).

## Notes

- `getKeys` and `getByIdKeys` remain supported for compatibility, but prefer `settings.get.keys` and `settings.getById.keys`.
- `primaryKey` performs an application-level duplicate check. Add a unique index to the Mongoose schema as the database-level guarantee.
- Search terms are used as regular-expression patterns. Restrict access and input length as appropriate for your application.

## License

Apache-2.0. See [license](license).
