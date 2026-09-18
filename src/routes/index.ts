import { randomUUID } from "crypto";
import { Request, RequestHandler, Router } from "express";
import Joi from "joi";
import { createController } from "../controllers";
import { ISetting, MaggiePayload } from "../utils/interface";
import { validateBody } from "../utils/validateBody";

const asHandler =
  (handler: (req: Request, res: any) => Promise<unknown>): RequestHandler =>
  async (req, res) => {
    await handler(req, res);
  };

const createMaggie = ({
  prefix,
  models,
  requestId,
  logger,
}: MaggiePayload): Router => {
  const router = Router();
  router.use((req, res, next) => {
    const id = requestId?.(req) || req.header("x-request-id") || randomUUID();
    (req as Request & { maggieRequestId?: string }).maggieRequestId = id;
    res.setHeader("x-request-id", id);
    next();
  });
  models.forEach(
    ({
      model,
      path,
      validationSchema,
      updateValidationSchema,
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
      const controller = createController(model, settingsObj, logger);
      const subRouter = Router();
      const createMiddleware: RequestHandler[] = [...middleWares];
      const updateMiddleware: RequestHandler[] = [...middleWares];
      const bulkMiddleware: RequestHandler[] = [...middleWares];
      if (validationSchema) {
        createMiddleware.push(validateBody(validationSchema));
        bulkMiddleware.push(validateBody(Joi.array().items(validationSchema)));
      }
      if (updateValidationSchema)
        updateMiddleware.push(validateBody(updateValidationSchema));
      else if (validationSchema)
        updateMiddleware.push(
          validateBody(
            validationSchema.fork(
              Object.keys(validationSchema.describe().keys || {}),
              (field) => field.optional(),
            ),
          ),
        );
      subRouter.post(
        "/",
        ...createMiddleware,
        asHandler(controller.addOrUpdate),
      );
      subRouter.post(
        "/bulk",
        ...bulkMiddleware,
        asHandler(controller.insertMany),
      );
      subRouter.patch(
        "/:id",
        ...updateMiddleware,
        asHandler(controller.update),
      );
      subRouter.delete("/:id", ...middleWares, asHandler(controller.remove));
      subRouter.get("/", ...middleWares, asHandler(controller.getAll));
      subRouter.get("/:id", ...middleWares, asHandler(controller.getById));
      router.use(`${prefix}/${path}`, subRouter);
    },
  );
  return router;
};
export default createMaggie;
