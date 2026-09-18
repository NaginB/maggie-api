import { RequestHandler } from "express";
import { Schema } from "joi";
import { sendError } from "./errors";
export const validateBody =
  (schema: Schema): RequestHandler =>
  (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true,
      convert: true,
    });
    if (error) {
      sendError(
        req,
        res,
        400,
        "VALIDATION_ERROR",
        "Validation error",
        error.details.map((detail) => ({
          message: detail.message,
          path: detail.path,
          type: detail.type,
        })),
      );
      return;
    }
    req.body = value;
    next();
  };
