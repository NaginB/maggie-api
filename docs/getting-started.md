# Getting started

This guide takes a connected Express application from a Mongoose model to a safe REST resource.

## 1. Install the package

```bash
npm install maggie-api express mongoose joi
```

Maggie supports Node.js 20, 22, and 24. Express, Mongoose, and Joi are peer dependencies so the host application controls their versions.

## 2. Define a model and request contract

Use Mongoose for persistence constraints and Joi for HTTP input. For example, a unique Mongoose index is the final guarantee against concurrent duplicate writes; `primaryKey` adds an earlier, friendlier conflict check.

```ts
const memberSchema = new Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  role: { type: String, enum: ["member", "admin"], default: "member" },
});

const Member = mongoose.model("Member", memberSchema);

const memberInput = Joi.object({
  name: Joi.string().trim().min(1).required(),
  email: Joi.string().email().required(),
  role: Joi.string().valid("member", "admin").default("member"),
});
```

## 3. Mount the router

```ts
app.use(express.json());

app.use(
  createMaggie({
    prefix: "/api/v3",
    models: [
      {
        model: Member,
        path: "members",
        primaryKey: "email",
        validationSchema: memberInput,
        settings: {
          legacyPostUpdate: false,
          get: {
            keys: ["_id", "name", "email", "role"],
            maxLimit: 50,
            search: { allowedFields: ["name", "email"] },
            filter: {
              fields: { role: { type: "string", operators: ["eq", "in"] } },
            },
            sort: { allowedFields: ["name"] },
          },
          getById: { keys: ["_id", "name", "email", "role"] },
        },
      },
    ],
  }),
);
```

## 4. Make requests

```bash
# Create
curl -X POST http://localhost:3000/api/v3/members \
  -H 'content-type: application/json' \
  -d '{"name":"Ada","email":"ada@example.com"}'

# Query only allow-listed fields
curl 'http://localhost:3000/api/v3/members?filter[role]=member&sort=name&limit=20&page=1'

# Partial update
curl -X PATCH http://localhost:3000/api/v3/members/<id> \
  -H 'content-type: application/json' \
  -d '{"name":"Ada Lovelace"}'
```

Successful responses include `success`, `statusCode`, `message`, and `data`. Errors add a stable `code`. Every generated route also returns an `x-request-id` header. Read [routes and responses](api-behavior.md) for the complete contract.

## Next steps

- Lock down real-world resources with the [security guide](security.md).
- Explore every option in the [configuration reference](configuration.md).
- Generate a specification using [OpenAPI](configuration.md#openapi).
