import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

export const validateBody = (schema: Schema): any => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error } = schema.validate(req.body, { abortEarly: true });
    if (error) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Validation error",
        error: error.details[0].message,
      });
    }
    next();
  };
};
