import Joi from "joi";
import { Schema } from "mongoose";

/** Creates a conservative Joi object schema from Mongoose schema paths. */
export const joiSchemaFromMongoose = (schema: Schema) => {
  const fields: Record<string, Joi.Schema> = {};
  for (const [path, definition] of Object.entries(schema.paths)) {
    if (path === "_id" || path === "__v") continue;
    const instance = (definition as any).instance;
    let field: Joi.Schema =
      instance === "Number"
        ? Joi.number()
        : instance === "Boolean"
          ? Joi.boolean()
          : instance === "Date"
            ? Joi.date()
            : instance === "Array"
              ? Joi.array()
              : Joi.string();
    if ((definition as any).isRequired) field = field.required();
    fields[path] = field;
  }
  return Joi.object(fields);
};
