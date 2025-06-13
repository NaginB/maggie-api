import { Router, RequestHandler } from "express";
import { createController } from "../controllers";
import { validateBody } from "../utils/validateBody";
import { Model } from "mongoose";
import Joi from "joi";

interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: Joi.ObjectSchema;
  primaryKey?: string;
  middleWares?: RequestHandler[];
  getKeys?: string[];
  getByIdKeys?: string[];
}

interface MaggiePayload {
  prefix: string;
  models: MaggieModelPayload[];
}

const createMaggie = ({ prefix, models }: MaggiePayload): Router => {
  const router = Router();

  models.forEach(
    ({
      model,
      path,
      validationSchema,
      primaryKey,
      middleWares = [],
      getKeys = [],
      getByIdKeys = [],
    }) => {
      const settings = { getByIdKeys, getKeys, primaryKey };
      const controller = createController(model, settings);
      const subRouter = Router();

      const middlewareStack: RequestHandler[] = [...middleWares];
      const bulkMiddlewareStack: RequestHandler[] = [...middleWares];

      if (validationSchema) {
        middlewareStack.push(validateBody(validationSchema));
        const bulkValidationSchema = Joi.array().items(validationSchema);
        bulkMiddlewareStack.push(validateBody(bulkValidationSchema));
      }

      subRouter.post("/", ...middlewareStack, controller.addOrUpdate);
      subRouter.post("/bulk", ...bulkMiddlewareStack, controller.insertMany);
      subRouter.delete("/:id", ...middleWares, controller.remove);
      subRouter.get("/", ...middleWares, controller.getAll);
      subRouter.get("/:id", ...middleWares, controller.getById);

      router.use(`${prefix}/${path}`, subRouter);
    }
  );

  return router;
};

export default createMaggie;
