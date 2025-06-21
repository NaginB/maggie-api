# 🧙‍♀️ maggie-api

**Auto-generate full-featured CRUD APIs for your Mongoose models in Express with one powerful config.**

Supports:

- ✅ Joi Validation
- ✅ Custom Middlewares
- ✅ Unique Primary Key Constraints
- ✅ Add/Update Merged API
- ✅ Consistent JSON Responses
- ✅ Field Selection & Population
- ✅ Bulk Insert Support

---

## 📦 Installation

```bash
npm install maggie-api

# Peer dependencies
npm install express mongoose joi
```

---

## 🚀 Quick Start

```ts
import express from "express";
import { createMaggie } from "maggie-api";
import Models from "./models";
import Joi from "joi";

const app = express();
app.use(express.json());

const UserValidationSchema = Joi.object({
  _id: Joi.string(),
  firstName: Joi.string().required(),
  lastName: Joi.string().required(),
  email: Joi.string().email().required(),
});

const apiRouter = createMaggie({
  prefix: "/api/v1",
  models: [
    {
      model: Models.User,
      path: "user",
      validationSchema: UserValidationSchema,

      primaryKey: "email", // ✅ Enforces uniqueness for this key during creation

      // ⚠️ Deprecated: use settings.get.keys instead
      getKeys: ["_id", "firstName", "email"],

      // ⚠️ Deprecated: use settings.getById.keys instead
      getByIdKeys: ["_id", "firstName", "lastName", "email"],

      // 🛡️ Optional: Add Express middleware (auth, logging, etc.)
      middleWares: [],

      // ✅ Recommended: Use `settings.get` and `settings.getById` for field selection and population
      settings: {
        get: {
          populate: [{ path: "department", select: ["_id", "title"] }],
          keys: ["_id"], // ✅ Only fetch these fields for GET /user
        },
        getById: {
          populate: [
            {
              path: "department",
              select: ["_id", "title"],
              populate: [{ path: "item", selected: ["_id", "title"] }],
            },
          ],
          keys: ["_id"], // ✅ Only fetch these fields for GET /user/:id
        },
      },
    },
  ],
});

app.use(apiRouter);

app.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
```

---

## 🛠 Features

### 1. Add or Update API (`POST /:model`)

- Merges create and update logic into a single endpoint.
- If the request body contains `_id`, it triggers an update; otherwise, a new record is created.
- Automatically checks `primaryKey` uniqueness during creation.
- During update, it ignores the current document when checking for duplicates.

### 2. Joi Validation

- Supports request body validation using Joi schemas for `POST` operations.
- Only one validation error message is returned per request to enhance clarity.
- Validation schemas are customizable per model.

### 3. Primary Key Uniqueness

- Define a `primaryKey` (e.g. `email`, `username`) to enforce uniqueness on creation.
- If a duplicate is found, the API returns a descriptive error.

### 4. Custom Middlewares

- Use the `middleWares` array to inject custom Express middlewares into the `POST` route.
- Enables features like authentication, authorization, logging, etc.

### 5. Field Filtering (Deprecated)

- ⚠️ `getKeys` and `getByIdKeys` are deprecated.
- Use `settings.get.keys` to select fields in `GET /:model`.
- Use `settings.getById.keys` to select fields in `GET /:model/:id`.
- This improves flexibility and aligns with modern structured configurations.

### 6. CRUD Endpoints (Auto-generated)

| Method   | Endpoint            | Description           |
| -------- | ------------------- | --------------------- |
| `POST`   | `/api/v1/user`      | Create or Update User |
| `POST`   | `/api/v1/user/bulk` | Bulk Insert Users     |
| `GET`    | `/api/v1/user`      | Fetch all Users       |
| `GET`    | `/api/v1/user/:id`  | Fetch User by ID      |
| `DELETE` | `/api/v1/user/:id`  | Delete User by ID     |

---

### 7. Population Support

- Use `settings.get.populate` and `settings.getById.populate` to populate referenced fields.
- Each populate config accepts a `path` and optional `select` array for nested or targeted population.

```ts
settings: {
  get: {
    populate: [
      { path: "department", select: ["_id", "title"] }
    ]
  },
  getById: {
    populate: [
      { path: "department", select: ["_id", "title"] }
    ]
  }
}
```

## 📡 Sample cURL Commands

### ➕ Add a User

```bash
curl -X POST http://localhost:3000/api/v1/user \
-H "Content-Type: application/json" \
-d '{"firstName":"Alice","lastName":"Doe","email":"alice@example.com"}'
```

### ✏️ Update a User

```bash
curl -X POST http://localhost:3000/api/v1/user \
-H "Content-Type: application/json" \
-d '{"_id":"665c8d1234567890","firstName":"Alicia","email":"alice@example.com"}'
```

### 📄 Get All Users

```bash
curl http://localhost:3000/api/v1/user
```

### 🔍 Get User by ID

```bash
curl http://localhost:3000/api/v1/user/665c8d1234567890
```

### ❌ Delete User by ID

```bash
curl -X DELETE http://localhost:3000/api/v1/user/665c8d1234567890
```

### 🚚 Bulk Insert Users

```bash
curl -X POST http://localhost:3000/api/v1/user/bulk \
-H "Content-Type: application/json" \
-d '[
  {"firstName":"Bob","lastName":"Smith","email":"bob@example.com"},
  {"firstName":"Carol","lastName":"Jones","email":"carol@example.com"}
]'
```

---

## ✅ Standard JSON Response Format

### On success:

```json
{
  "success": true,
  "statusCode": 200,
  "message": "User updated successfully",
  "data": {
    "_id": "...",
    "firstName": "Alicia",
    "email": "alice@example.com"
  }
}
```

### On validation failure:

```json
{
  "success": false,
  "statusCode": 400,
  "message": "Validation error",
  "error": "\"email\" is required"
}
```

---

## 📂 Example Project Structure

```
your-app/
├── models/
│   └── User.ts
├── routes/
│   └── index.ts
├── utils/
│   └── validateBody.ts
├── app.ts
└── ...
```

---

## 👏 Contributing

Want to contribute or enhance? PRs are welcome!

- Add new features like PATCH support, role-based auth, etc.
- Improve test coverage
- Bug fixes

---

## 📢 Final Words

Save hours of boilerplate setup. Focus on your app logic.

Let `maggie-api` handle the API plumbing. 🚀
