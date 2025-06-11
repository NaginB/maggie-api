// src/utils/validateBody.ts
import { Request, Response, NextFunction } from "express";
import Joi from "joi";

export const validateBody = (schema: Joi.ObjectSchema): any => {
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
