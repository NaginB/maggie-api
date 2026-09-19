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
      models: [
        {
          model: OpenApiUser,
          path: "users",
          validationSchema: Joi.object({
            email: Joi.string().email().required(),
          }),
        },
      ],
    });
    expect(document.openapi).toBe("3.1.0");
    expect(document.paths["/api/v2/users"]).toBeDefined();
    expect(document.paths["/api/v2/users/{id}"]).toBeDefined();
    expect(document.components.schemas.OpenApiUser).toMatchObject({
      type: "object",
      required: ["email"],
    });
    expect(document.components.responses.NotFound).toBeDefined();
  });
});
