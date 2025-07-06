import { Request, Response, NextFunction } from "express";
import { Schema } from "joi";

export const validateBody = (schema: Schema): any => {
  return (req: Request, res: Response, next: NextFunction) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false, // collect all errors
      stripUnknown: true, // remove unknown keys
      convert: true, // apply defaults and type conversions
    });

    if (error) {
      return res.status(400).json({
        success: false,
        statusCode: 400,
        message: "Validation error",
        error: error.details.map((d) => d.message).join(", "),
      });
    }

    req.body = value; // assign validated + defaulted data
    next();
  };
};
