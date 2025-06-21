import { Router, RequestHandler } from "express";
import { createController } from "../controllers";
import { validateBody } from "../utils/validateBody";
import Joi from "joi";
import { ISetting, MaggiePayload } from "../utils/interface";

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
      settings,
    }) => {
      const settingsObj: ISetting = {
        getByIdKeys: settings?.getById?.keys ?? getByIdKeys,
        getKeys: settings?.get?.keys ?? getKeys,
        primaryKey,
        ...settings,
      };

      const controller = createController(model, settingsObj);
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
