import express from "express";
import Joi from "joi";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { validateBody } from "../../src/utils/validateBody";

describe("validateBody", () => {
  it("returns structured details for every Joi error", async () => {
    const app = express();
    app.use(express.json());
    app.post(
      "/",
      validateBody(
        Joi.object({
          name: Joi.string().required(),
          age: Joi.number().min(18).required(),
        }),
      ),
      (_req, res) => res.sendStatus(204),
    );
    const response = await request(app).post("/").send({ age: 10 });
    expect(response.status).toBe(400);
    expect(response.body.code).toBe("VALIDATION_ERROR");
    expect(response.body.data).toBeNull();
    expect(response.body.details).toHaveLength(2);
  });
});
