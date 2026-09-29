import Joi from "joi";
import mongoose, { Schema } from "mongoose";
import { describe, expect, it } from "vitest";
import { createOpenApiDocument } from "../../src";

const OpenApiUser = mongoose.model(
  "OpenApiUser",
  new Schema({ email: { type: String, required: true } }),
);

describe("createOpenApiDocument", () => {
  it("describes configured routes, schemas, parameters, and errors", () => {
    const document = createOpenApiDocument({
      prefix: "/api/v2",
      metadata: { authorize: () => true },
      models: [
        {
          model: OpenApiUser,
          path: "users",
          validationSchema: Joi.object({
            email: Joi.string().email().required(),
          }),
          settings: {
            bulk: { allowUpdate: true, allowDelete: true },
            get: {
              cursorPagination: { field: "createdAt" },
              clientProjection: { allowedFields: ["email"] },
              clientPopulate: { allowedPaths: ["team"] },
            },
            relations: [
              {
                path: "members",
                model: OpenApiUser,
                foreignField: "teamId",
              },
            ],
          },
        },
      ],
    });
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/api/v2/users"]).toBeDefined();
    expect(document.paths["/api/v2/users/{id}"]).toBeDefined();
    expect(document.paths["/api/v2/users/bulk"].patch).toBeDefined();
    expect(document.paths["/api/v2/users/bulk"].delete).toBeDefined();
    expect(document.paths["/api/v2/users/{id}/members"]).toBeDefined();
    expect(document.paths["/api/v2/_meta"]).toBeDefined();
    expect(document.paths["/api/v2/users"].get.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: "filter" }),
        expect.objectContaining({ name: "cursor" }),
        expect.objectContaining({ name: "fields" }),
        expect.objectContaining({ name: "populate" }),
      ]),
    );
    expect(document.components.schemas.OpenApiUser).toMatchObject({
      type: "object",
      required: ["email"],
    });
    expect(document.components.responses.NotFound).toBeDefined();
  });
});
