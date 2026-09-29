import { RequestHandler } from "express";
import { Schema } from "joi";
import { sendError } from "./errors";

const validate = (schema: Schema, body: unknown) =>
  schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });

const validationError = (
  req: Parameters<RequestHandler>[0],
  res: Parameters<RequestHandler>[1],
  error: any,
) =>
  sendError(
    req,
    res,
    400,
    "VALIDATION_ERROR",
    "Validation error",
    error.details.map((detail: any) => ({
      message: detail.message,
      path: detail.path,
      type: detail.type,
    })),
  );

export const validateBody =
  (schema: Schema): RequestHandler =>
  (req, res, next) => {
    const { error, value } = validate(schema, req.body);
    if (error) {
      validationError(req, res, error);
      return;
    }
    req.body = value;
    next();
  };

/** Validates and replaces one object field while preserving the surrounding body. */
export const validateBodyField =
  (field: string, schema: Schema): RequestHandler =>
  (req, res, next) => {
    const { error, value } = validate(schema, req.body?.[field]);
    if (error) {
      validationError(req, res, error);
      return;
    }
    req.body = { ...req.body, [field]: value };
    next();
  };
