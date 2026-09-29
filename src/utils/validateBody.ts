import { RequestHandler } from "express";
import { sendError } from "./errors";
import { ValidationSchema, ZodSchemaLike } from "./interface";

const isZodSchema = (schema: ValidationSchema): schema is ZodSchemaLike =>
  typeof (schema as ZodSchemaLike).safeParse === "function";

const validate = (schema: ValidationSchema, body: unknown) => {
  if (isZodSchema(schema)) {
    const result = schema.safeParse(body);
    return result.success
      ? { value: result.data }
      : {
          error: {
            details: result.error.issues.map((issue) => ({
              message: issue.message,
              path: issue.path,
              type: issue.code,
            })),
          },
        };
  }
  return schema.validate(body, {
    abortEarly: false,
    stripUnknown: true,
    convert: true,
  });
};

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
  (schema: ValidationSchema): RequestHandler =>
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
  (field: string, schema: ValidationSchema): RequestHandler =>
  (req, res, next) => {
    const { error, value } = validate(schema, req.body?.[field]);
    if (error) {
      validationError(req, res, error);
      return;
    }
    req.body = { ...req.body, [field]: value };
    next();
  };

export const optionalValidationSchema = (
  schema: ValidationSchema,
): ValidationSchema => {
  if (isZodSchema(schema)) {
    if (!schema.partial)
      throw new Error(
        "Zod update schemas must be object schemas with partial()",
      );
    return schema.partial();
  }
  return schema.fork(Object.keys(schema.describe().keys || {}), (field) =>
    field.optional(),
  );
};
