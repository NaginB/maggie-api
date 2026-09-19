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
const PatchOnly = mongoose.model(
  "PatchOnly",
  new Schema({ name: { type: String, required: true } }),
);
const UniqueOnly = mongoose.model(
  "UniqueOnly",
  new Schema({ email: { type: String, unique: true, required: true } }),
);
const NoContent = mongoose.model(
  "NoContent",
  new Schema({ name: { type: String, required: true } }),
);
const SoftPerson = mongoose.model(
  "SoftPerson",
  new Schema({
    name: { type: String, required: true },
    deletedAt: Date,
    deletedBy: String,
  }),
);
const Department = mongoose.model(
  "DepartmentForV2",
  new Schema({ name: { type: String, required: true } }),
);
const Employee = mongoose.model(
  "EmployeeForV2",
  new Schema({
    name: { type: String, required: true },
    department: { type: Schema.Types.ObjectId, ref: "DepartmentForV2" },
  }),
);
const MiddlewarePerson = mongoose.model(
  "MiddlewarePerson",
  new Schema({ name: { type: String, required: true } }),
);
const middlewareOrder: string[] = [];
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
              logicalOperators: ["or"],
              fields: {
                age: {
                  type: "number",
                  operators: ["eq", "ne", "nin", "gte", "lte", "exists"],
                },
                active: { type: "boolean", operators: ["eq"] },
                name: { operators: ["regex"], allowRegex: true },
              },
            },
            sort: { allowedFields: ["name", "age"] },
            maxLimit: 2,
            cursorPagination: { field: "age", type: "number", maxLimit: 2 },
          },
        },
      },
    ],
  }),
);
const patchOnlyApp = express();
patchOnlyApp.use(express.json());
patchOnlyApp.use(
  createMaggie({
    prefix: "/api",
    requestId: (req) => req.header("x-custom-request") || undefined,
    models: [
      {
        model: PatchOnly,
        path: "patch-only",
        updateValidationSchema: Joi.object({
          name: Joi.string().min(3).required(),
        }),
      },
      { model: UniqueOnly, path: "unique-only" },
      { model: NoContent, path: "no-content", settings: { deleteStatus: 204 } },
      {
        model: SoftPerson,
        path: "soft-people",
        settings: {
          softDelete: {
            deletedBy: "deletedBy",
            getDeletedBy: (req) => req.header("x-actor"),
          },
        },
      },
      {
        model: Employee,
        path: "employees",
        settings: {
          get: { populate: [{ path: "department", select: ["name"] }] },
        },
      },
      {
        model: MiddlewarePerson,
        path: "middleware-people",
        middleWares: [
          (_req, _res, next) => {
            middlewareOrder.push("first");
            next();
          },
          (_req, _res, next) => {
            middlewareOrder.push("second");
            next();
          },
        ],
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
    const legacyUpdated = await request(app)
      .post("/api/people")
      .send({ _id: id, name: "Ada Byron", email: "ada@example.com" });
    expect(legacyUpdated.status).toBe(200);
    const replaced = await request(app)
      .put(`/api/people/${id}`)
      .send({ name: "Ada King", email: "ada@example.com" });
    expect(replaced.status).toBe(200);
    expect(replaced.body.data.age).toBeUndefined();
    const patched = await request(app)
      .patch(`/api/people/${id}`)
      .send({ name: "Ada Lovelace" });
    expect(patched.status).toBe(200);
    expect(patched.body.data.name).toBe("Ada Lovelace");
    expect((await request(app).delete(`/api/people/${id}`)).status).toBe(200);
    expect((await request(app).delete(`/api/people/${id}`)).status).toBe(404);
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
    expect(
      (await request(app).get("/api/people?filter[age][ne]=20")).body.data
        .members,
    ).toHaveLength(1);
    expect(
      (await request(app).get("/api/people?filter[name][regex]=^B")).body.data
        .members,
    ).toHaveLength(1);
    expect(
      (
        await request(app).get(
          "/api/people?filter[$or][0][age][gte]=25&filter[$or][1][active]=true",
        )
      ).body.data.members,
    ).toHaveLength(2);
    const firstCursorPage = await request(app).get(
      "/api/people?cursor=start&limit=1",
    );
    expect(firstCursorPage.body.data.members).toHaveLength(1);
    expect(firstCursorPage.body.data.cursorPagination.nextCursor).toBeTruthy();
    const secondCursorPage = await request(app).get(
      `/api/people?cursor=${firstCursorPage.body.data.cursorPagination.nextCursor}&limit=1`,
    );
    expect(secondCursorPage.body.data.members).toHaveLength(1);
    expect(secondCursorPage.body.data.members[0].name).toBe("Bee");
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
  it("rejects primary-key conflicts in bulk requests and the database", async () => {
    const duplicateInRequest = await request(app)
      .post("/api/people/bulk")
      .send([
        { name: "A", email: "same@example.com" },
        { name: "B", email: "same@example.com" },
      ]);
    expect(duplicateInRequest.status).toBe(409);
    expect(duplicateInRequest.body.code).toBe("CONFLICT");

    await User.create({ name: "Existing", email: "existing@example.com" });
    const duplicateInDatabase = await request(app)
      .post("/api/people/bulk")
      .send([{ name: "Other", email: "existing@example.com" }]);
    expect(duplicateInDatabase.status).toBe(409);
    expect(duplicateInDatabase.body.code).toBe("CONFLICT");
  });
  it("applies updateValidationSchema without a create validationSchema", async () => {
    const created = await PatchOnly.create({ name: "Valid" });
    const invalid = await request(patchOnlyApp)
      .patch(`/api/patch-only/${created.id}`)
      .send({ name: "x" });
    expect(invalid.status).toBe(400);
    expect(invalid.body.code).toBe("VALIDATION_ERROR");
  });
  it("normalizes database conflicts and supports 204 deletes", async () => {
    await UniqueOnly.create({ email: "taken@example.com" });
    const conflict = await request(patchOnlyApp)
      .post("/api/unique-only")
      .send({ email: "taken@example.com" });
    expect(conflict.status).toBe(409);
    expect(conflict.body.code).toBe("CONFLICT");

    const created = await NoContent.create({ name: "Disposable" });
    const deleted = await request(patchOnlyApp).delete(
      `/api/no-content/${created.id}`,
    );
    expect(deleted.status).toBe(204);
    expect(deleted.text).toBe("");

    const raced = await Promise.all(
      ["First", "Second"].map((name) =>
        request(patchOnlyApp)
          .post("/api/unique-only")
          .send({ email: "race@example.com", name }),
      ),
    );
    expect(raced.map((response) => response.status).sort()).toEqual([201, 409]);
  });
  it("soft-deletes records and hides them from reads", async () => {
    const created = await SoftPerson.create({ name: "Recoverable" });
    const deleted = await request(patchOnlyApp)
      .delete(`/api/soft-people/${created.id}`)
      .set("x-actor", "admin-42");
    expect(deleted.status).toBe(200);
    expect(deleted.body.data.deletedBy).toBe("admin-42");
    expect(deleted.body.data.deletedAt).toBeTruthy();
    expect(
      (await request(patchOnlyApp).get(`/api/soft-people/${created.id}`))
        .status,
    ).toBe(404);
    expect(
      (await request(patchOnlyApp).get("/api/soft-people")).body.data
        .softpeople,
    ).toHaveLength(0);
    expect((await SoftPerson.findById(created.id))?.deletedAt).toBeTruthy();
  });
  it("populates configured relations and preserves middleware and request-ID behavior", async () => {
    const department = await Department.create({ name: "Engineering" });
    await Employee.create({ name: "Ada", department: department.id });
    const employees = await request(patchOnlyApp).get("/api/employees");
    expect(employees.body.data.employeeforv2s[0].department.name).toBe(
      "Engineering",
    );

    middlewareOrder.length = 0;
    const response = await request(patchOnlyApp)
      .post("/api/middleware-people")
      .set("x-custom-request", "request-123")
      .send({ name: "Ordered" });
    expect(response.status).toBe(201);
    expect(response.headers["x-request-id"]).toBe("request-123");
    expect(middlewareOrder).toEqual(["first", "second"]);
  });
});
