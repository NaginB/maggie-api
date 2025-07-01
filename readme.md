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
- ✅ Dynamic Search (with keyword, fields, and case sensitivity support)

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
      model: ProductModel,
      path: "product",
      validationSchema: productValidationSchema,
      settings: {
        get: {
          // ✅ Only these fields will be returned in GET /product
          keys: ["_id", "title", "price", "description", "subCategory"],

          // 🔍 Search by title or description using `?search=some+word`
          search: {
            disabled: false,
            allowedFields: ["title", "description"],
          },

          // 🧹 Allow filtering via `?filter[price][gte]=100` or `filter[title]=Shoes`
          filter: {
            allowedFields: ["price", "title", "subCategory"],
          },

          // 🔗 Populate referenced subCategory and its category
          populate: [
            {
              path: "subCategory",
              select: ["_id", "title"],
              populate: [{ path: "category", select: ["_id", "title"] }],
            },
          ],
        },

        getById: {
          // ✅ Only these fields will be returned in GET /product/:id
          keys: ["_id", "title", "description", "price", "subCategory"],

          // 🔗 Nested populate same as `get`
          populate: [
            {
              path: "subCategory",
              select: ["_id", "title"],
              populate: [{ path: "category", select: ["_id", "title"] }],
            },
          ],
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
      {
        path: "department",
        select: ["_id", "title"] ,
        populate: [
          {
            path: "item",
            selected: ["_id", "title"]
          }
         ],
      }
    ]
  }
}
```

### 8. Search Support

- ✅ Use `settings.get.search` to enable keyword-based searching on specific fields.
- 🔍 Accepts query parameters like `search`, `searchFields`, and `caseSensitive`.
- 🧩 Only fields defined in `allowedFields` will be considered for searching.
- 🛑 If `disabled: true`, searching will be turned off for that model.
- 🌐 Falls back to all allowed fields if `searchFields` param is not provided.

**Example Setting:**

```ts
settings: {
  get: {
    search: {
      disabled: false,
      allowedFields: ["title", "description", "email"]
    }
  }
}
```

**Sample Request:**

```http
GET /api/v1/user?search=mascara&searchFields=title,description&caseSensitive=false
```

**Behavior:**

- Builds a `$or` regex search query for all specified fields.
- If no valid fields are provided or allowed → search is skipped.

### 9. Sorting, Pagination & Filtering (Built-in)

Sorting, pagination, and filtering are first-class citizens in `maggie-api`, available out of the box for all models.

---

#### 🔀 Sorting

- Pass a `sort` query param to define sort order:

  ```http
  ?sort=-createdAt,name
  ```

- Use a hyphen (`-`) prefix for descending order.
- Multiple fields can be sorted in sequence.
- Sorting is always enabled — no extra config needed.

---

#### 📄 Pagination

- Supports standard pagination via `limit` and `page` query parameters:

  ```http
  ?limit=10&page=2
  ```

- Only applied when **both** parameters are valid positive integers.
- Automatically returns metadata:

  ```json
  {
    "users": [...],
    "pagination": {
      "total": 100,
      "page": 2,
      "limit": 10,
      "totalPages": 10
    }
  }
  ```

- If not provided, returns the full result set without pagination.

---

#### 🔎 Filtering

- Add structured filters using the `filter` query param:

  ```http
  ?filter[price][gte]=100&filter[status]=active
  ```

- Supports:

  - Basic equality: `filter[field]=value`
  - Ranges: `gte`, `lte`, `gt`, `lt`
  - Arrays: `filter[tags][]=tag1&filter[tags][]=tag2` (interpreted as `$in`)

- Only fields listed in `settings.get.filter.allowedFields` are considered.
- Invalid or unlisted fields are ignored silently for safety.

**Example Configuration:**

```ts
settings: {
  get: {
    filter: {
      allowedFields: ["status", "price", "category"];
    }
  }
}
```

---

#### 📌 Example:

```http
GET /api/v1/product?filter[price][gte]=500&sort=-createdAt&limit=10&page=1
```

> ⚠️ Sorting and pagination are always enabled by default. Filtering requires configuring `allowedFields` to avoid accidental or insecure filtering.

This makes it easy to power powerful, customizable tables and dashboards with minimal backend configuration.

---

### 10. Filter Support

`maggie-api` allows powerful and flexible filtering on API endpoints using structured query parameters.

#### 🔧 Key Features:

- Declarative control over filterable fields via `settings.get.filter.allowedFields`
- Automatically transforms nested filters into MongoDB-compatible queries
- Supports value types: primitives, arrays, and range operators

#### 🔤 Supported Operators:

| Operator | Usage                    | Translates To              |
| -------- | ------------------------ | -------------------------- |
| eq       | `filter[status]=active`  | `{ status: "active" }`     |
| in       | `filter[tags][]=a&[]=b`  | `{ tags: { $in: [...] } }` |
| gte      | `filter[price][gte]=100` | `{ price: { $gte: 100 } }` |
| lte      | `filter[price][lte]=500` | `{ price: { $lte: 500 } }` |
| gt, lt   | Similar usage            | `$gt`, `$lt`               |

#### 💡 Behavior:

- If a filter field is not included in `allowedFields`, it will be silently ignored.
- Case-sensitive by default (you may use search for regex-based keyword lookups).
- Compatible with MongoDB query syntax for advanced filtering.

#### 🧪 Example Request:

```http
GET /api/v1/user?filter[role]=admin&filter[age][gte]=18
```

#### ⚠️ Important:

- Always whitelist filterable fields to avoid misuse or performance hits
- For flexible keyword matching across multiple fields, use the `search` config instead

This filtering system is perfect for admin dashboards, search filters, and dynamic list views.

---

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
