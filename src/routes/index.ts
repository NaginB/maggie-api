import { Router } from "express";
import { createController } from "../controllers";
import { validateBody } from "../utils/validateBody";
import { Model } from "mongoose";
import Joi from "joi";

interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: Joi.ObjectSchema;
}

interface MaggiePayload {
  prefix: string;
  models: MaggieModelPayload[];
}

const createMaggie = ({ prefix, models }: MaggiePayload): Router => {
  const router = Router();

  models.forEach(({ model, path, validationSchema }) => {
    const controller = createController(model);
    const subRouter = Router();

    if (validationSchema) {
      subRouter.post(
        "/",
        validateBody(validationSchema),
        controller.addOrUpdate
      );
    } else {
      subRouter.post("/", controller.addOrUpdate);
    }

    subRouter.delete("/:id", controller.remove);
    subRouter.get("/", controller.getAll);
    subRouter.get("/:id", controller.getById);

    router.use(`${prefix}/${path}`, subRouter);
  });

  return router;
};

export default createMaggie;
