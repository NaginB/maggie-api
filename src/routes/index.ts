// src/routes/index.ts
import express, { Router } from "express";
import { createController } from "../controllers";
import { Model } from "mongoose";

interface MaggieModelPayload {
  model: Model<any>;
  path: string;
}

interface MaggieInput {
  prefix: string;
  models: MaggieModelPayload[];
}

const createMaggie = ({ prefix, models }: MaggieInput): Router => {
  const router = express.Router();

  models.forEach(({ model, path }) => {
    const controller = createController(model);
    const subRouter = express.Router();

    // subRouter.post("/", controller.add);
    // subRouter.put("/", controller.update);
    subRouter.post("/", controller.addOrUpdate);
    subRouter.delete("/:id", controller.remove);
    subRouter.get("/", controller.getAll);
    subRouter.get("/:id", controller.getById);

    router.use(`${prefix}/${path}`, subRouter);
  });

  return router;
};

export default createMaggie;
