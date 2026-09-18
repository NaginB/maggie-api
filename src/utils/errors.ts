import { Request, Response } from "express";
import { Error as MongooseError } from "mongoose";
import { ApiResponse, ErrorCode, MaggieLogger } from "./interface";

export class HttpError extends Error {
  constructor(
    public statusCode: number,
    public code: ErrorCode,
    message: string,
    public details?: unknown,
  ) {
    super(message);
  }
}
export const isCastError = (error: unknown): error is MongooseError.CastError =>
  error instanceof MongooseError.CastError ||
  (!!error && typeof error === "object" && (error as any).name === "CastError");
export const isDuplicateKeyError = (error: unknown): boolean =>
  !!error && typeof error === "object" && (error as any).code === 11000;
export const requestIdOf = (req: Request): string | undefined =>
  (req as Request & { maggieRequestId?: string }).maggieRequestId ||
  req.header("x-request-id") ||
  undefined;
export const sendError = (
  req: Request,
  res: Response,
  statusCode: number,
  code: ErrorCode,
  message: string,
  details?: unknown,
) => {
  const body: ApiResponse<never> = {
    success: false,
    statusCode,
    message,
    data: null,
    code,
  };
  if (details !== undefined) body.details = details;
  const requestId = requestIdOf(req);
  if (requestId) body.requestId = requestId;
  return res.status(statusCode).json(body);
};
export const handleError = (
  req: Request,
  res: Response,
  error: unknown,
  logger?: MaggieLogger,
) => {
  let mapped: HttpError;
  if (error instanceof HttpError) mapped = error;
  else if (isCastError(error))
    mapped = new HttpError(400, "INVALID_ID", "Invalid id");
  else if (isDuplicateKeyError(error))
    mapped = new HttpError(
      409,
      "CONFLICT",
      "A document with the same unique value already exists",
      (error as any).details,
    );
  else if (error instanceof MongooseError.ValidationError)
    mapped = new HttpError(
      400,
      "VALIDATION_ERROR",
      "Validation error",
      Object.values(error.errors).map((item) => item.message),
    );
  else mapped = new HttpError(500, "INTERNAL_ERROR", "Internal server error");
  if (mapped.statusCode >= 500)
    logger?.error?.({
      level: "error",
      message: mapped.message,
      requestId: requestIdOf(req),
      method: req.method,
      path: req.originalUrl,
      error,
    });
  return sendError(
    req,
    res,
    mapped.statusCode,
    mapped.code,
    mapped.message,
    mapped.details,
  );
};
