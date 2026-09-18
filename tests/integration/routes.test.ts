import express from "express";
import Joi from "joi";
import mongoose, { Schema } from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import createMaggie from "../../src/routes";

let mongo: MongoMemoryServer;
const schema = new Schema({
  name: { type: String, required: true },
  email: { type: String, unique: true, required: true },
  age: { type: Number, min: 0 },
  active: Boolean,
});
const User = mongoose.model("Person", schema);
const app = express();
app.use(express.json());
app.use(
  createMaggie({
    prefix: "/api",
    requestId: () => "test-request",
    models: [
      {
        model: User,
        path: "people",
        primaryKey: "email",
        validationSchema: Joi.object({
          _id: Joi.string(),
          name: Joi.string().required(),
          email: Joi.string().email().required(),
          age: Joi.number().min(0),
          active: Joi.boolean(),
        }),
        settings: {
          responseKey: "members",
          maxBulkSize: 2,
          get: {
            keys: ["name", "email", "age", "active"],
            search: { allowedFields: ["name"], maxLength: 10 },
            filter: {
              strict: true,
              fields: {
                age: { type: "number", operators: ["eq", "gte", "lte"] },
                active: { type: "boolean", operators: ["eq"] },
              },
            },
            sort: { allowedFields: ["name", "age"] },
            maxLimit: 2,
          },
        },
      },
    ],
  }),
);

beforeAll(async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
  await User.syncIndexes();
});
afterAll(async () => {
  await mongoose.disconnect();
  await mongo.stop();
});

describe("generated routes", () => {
  it("creates, reads, patches and deletes with stable envelopes", async () => {
    const created = await request(app)
      .post("/api/people")
      .send({ name: "Ada", email: "ada@example.com", age: 30, active: true });
    expect(created.status).toBe(201);
    expect(created.headers["x-request-id"]).toBe("test-request");
    const id = created.body.data._id;
    expect((await request(app).get(`/api/people/${id}`)).status).toBe(200);
    const patched = await request(app)
      .patch(`/api/people/${id}`)
      .send({ name: "Ada Lovelace" });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe("Ada Lovelace");
    expect((await request(app).delete(`/api/people/${id}`)).status).toBe(200);
    const missing = await request(app).get(`/api/people/${id}`);
    expect(missing.status).toBe(404);
    expect(missing.body.code).toBe("NOT_FOUND");
  });
  it("distinguishes invalid ids and conflicts", async () => {
    await User.create({ name: "Grace", email: "grace@example.com", age: 40 });
    const invalid = await request(app).get("/api/people/not-an-id");
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("INVALID_ID");
    const conflict = await request(app)
      .post("/api/people")
      .send({ name: "Other", email: "grace@example.com" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("CONFLICT");
  });
  it("supports safe search, typed filters, sorting and pagination", async () => {
    await User.deleteMany({});
    await User.create([
      { name: "A.*", email: "literal@example.com", age: 20, active: true },
      { name: "Bee", email: "bee@example.com", age: 25, active: false },
    ]);
    const literal = await request(app).get("/api/people?search=A.*");
    expect(literal.body.data.members).toHaveLength(1);
    const list = await request(app).get(
      "/api/people?filter[age][gte]=20&sort=-age&limit=2&page=1",
    );
    expect(list.status).toBe(200);
    expect(list.body.data.pagination.total).toBe(2);
    expect(list.body.data.members[0].name).toBe("Bee");
    expect((await request(app).get("/api/people?sort=email")).status).toBe(400);
    expect(
      (await request(app).get("/api/people?filter[age][gte]=bad")).status,
    ).toBe(400);
    expect((await request(app).get("/api/people?limit=3&page=1")).status).toBe(
      400,
    );
  });
  it("enforces bulk limits and reports per-item validation", async () => {
    const tooMany = await request(app)
      .post("/api/people/bulk")
      .send([
        { name: "A", email: "a@x.com" },
        { name: "B", email: "b@x.com" },
        { name: "C", email: "c@x.com" },
      ]);
    expect(tooMany.status).toBe(413);
    const invalid = await request(app)
      .post("/api/people/bulk")
      .send([{ name: "A" }, { email: "b@x.com" }]);
    expect(invalid.status).toBe(400);
    expect(invalid.body.details.length).toBeGreaterThan(1);
  });
});
