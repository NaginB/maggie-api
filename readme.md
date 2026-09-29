# maggie-api

> A secure, configurable CRUD router for Express and Mongoose.

[![CI](https://github.com/NaginB/maggie-api/actions/workflows/ci.yml/badge.svg)](https://github.com/NaginB/maggie-api/actions/workflows/ci.yml)
![TypeScript declarations included](https://img.shields.io/badge/TypeScript-declarations%20included-3178C6?logo=typescript&logoColor=white)

`maggie-api` turns a Mongoose model into a conventional REST resource without giving up control. Start with predictable CRUD routes, then explicitly opt into validation, field permissions, query controls, authorization, tenancy, soft deletes, bulk writes, relations, and OpenAPI.

|         |                                                                   |
| ------- | ----------------------------------------------------------------- |
| Runtime | Node.js `>=20 <25`                                                |
| Peers   | Express `>=5.2.1 <6`, Mongoose `>=8.24.4 <9`, Joi `>=17.13.8 <18` |
| Package | `maggie-api@3`                                                    |

## Why Maggie?

- **Secure by default.** Client-controlled filtering, sorting, search, projection, and population are allow-listed.
- **A familiar API.** Generate `POST`, `GET`, `PATCH`, `PUT`, and `DELETE` routes for each model.
- **Production controls.** Apply authorizers, row scopes, tenant isolation, lifecycle hooks, events, caching, and soft deletion at the resource boundary.
- **One source of truth.** Generate an OpenAPI 3.1 document from the same configuration that builds the router.

## Documentation

| Start here                                   | Build safely                                  | Reference                                  |
| -------------------------------------------- | --------------------------------------------- | ------------------------------------------ |
| [Quick start](docs/getting-started.md)       | [Features explained simply](docs/features.md) | [Configuration](docs/configuration.md)     |
| [Routes and responses](docs/api-behavior.md) | [Migration guide](docs/v2-migration.md)       | [Full documentation index](docs/README.md) |

## Install

```bash
npm install maggie-api express mongoose joi
```

Connect Mongoose before serving requests. Maggie does not create a database connection or parse request bodies for you.

## Five-minute quick start

```ts
import express from "express";
import mongoose, { Schema } from "mongoose";
import Joi from "joi";
import { createMaggie } from "maggie-api";

const app = express();
app.use(express.json());

const User = mongoose.model(
  "User",
  new Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
  }),
);

app.use(
  createMaggie({
    prefix: "/api/v3",
    models: [
      {
        model: User,
        path: "users",
        primaryKey: "email",
        validationSchema: Joi.object({
          name: Joi.string().trim().min(1).required(),
          email: Joi.string().email().required(),
        }),
        settings: {
          legacyPostUpdate: false,
          get: {
            keys: ["_id", "name", "email"],
            maxLimit: 50,
            search: { allowedFields: ["name", "email"] },
            filter: { fields: { email: { type: "string" } } },
            sort: { allowedFields: ["name"] },
          },
          getById: { keys: ["_id", "name", "email"] },
        },
      },
    ],
  }),
);

await mongoose.connect(process.env.MONGODB_URI!);
app.listen(3000);
```

Try it:

```bash
curl -X POST http://localhost:3000/api/v3/users \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Lovelace","email":"ada@example.com"}'
```

## Routes at a glance

For `prefix: "/api/v3"` and `path: "users"`:

| Method   | Route                | Purpose                                                                        |
| -------- | -------------------- | ------------------------------------------------------------------------------ |
| `POST`   | `/api/v3/users`      | Create a document. A body with `_id` performs a legacy update unless disabled. |
| `POST`   | `/api/v3/users/bulk` | Create a non-empty array of documents.                                         |
| `GET`    | `/api/v3/users`      | List documents using configured query controls.                                |
| `GET`    | `/api/v3/users/:id`  | Fetch one document.                                                            |
| `PATCH`  | `/api/v3/users/:id`  | Partially update one document.                                                 |
| `PUT`    | `/api/v3/users/:id`  | Replace one document.                                                          |
| `DELETE` | `/api/v3/users/:id`  | Delete or soft-delete one document.                                            |

Optional `PATCH /bulk` and `DELETE /bulk` routes require their respective `settings.bulk` flags. See the [API behavior reference](docs/api-behavior.md) for response envelopes, status codes, and query syntax.

## Production checklist

Before exposing a resource, configure these deliberately:

1. Use a Joi schema and Mongoose unique index for every value that must be unique.
2. Define `get.keys` and `getById.keys` so sensitive fields never leave the API.
3. Allow-list search, filter, and sort fields; leave regex and logical filters off unless needed.
4. Add `authorize`, `queryScope`, or `tenant` when requests are not public.
5. Turn off `legacyPostUpdate` once clients use `PATCH /:id`.

The [security guide](docs/security.md) explains each control and includes a hardened example.

## OpenAPI

Build a specification from the payload you pass to `createMaggie`:

```ts
import { createOpenApiDocument } from "maggie-api";

const document = createOpenApiDocument(maggiePayload, {
  title: "Members API",
  version: "3.0.0",
  description: "Public API for the Members service.",
});
```

## Development and support

Run `npm run check` before publishing a change. It runs formatting, linting, tests, TypeScript compilation, and a package-content check. See the [development guide](docs/development.md), [changelog](CHANGELOG.md), and [Apache-2.0 license](license).
