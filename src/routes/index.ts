import { randomUUID } from "crypto";
import { Request, RequestHandler, Router } from "express";
import Joi from "joi";
import { createController } from "../controllers";
import { ISetting, MaggieOperation, MaggiePayload } from "../utils/interface";
import { sendError } from "../utils/errors";
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
      replaceValidationSchema,
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
      const authorize =
        (operation: MaggieOperation): RequestHandler =>
        async (req, res, next) => {
          const allowed = await settingsObj.authorize?.[operation]?.(
            req,
            operation,
          );
          if (allowed === false)
            return void sendError(req, res, 403, "FORBIDDEN", "Forbidden");
          next();
        };
      const createMiddleware: RequestHandler[] = [...middleWares];
      const updateMiddleware: RequestHandler[] = [...middleWares];
      const replaceMiddleware: RequestHandler[] = [...middleWares];
      const bulkMiddleware: RequestHandler[] = [...middleWares];
      if (validationSchema) {
        createMiddleware.push(validateBody(validationSchema));
        bulkMiddleware.push(validateBody(Joi.array().items(validationSchema)));
      }
      if (replaceValidationSchema)
        replaceMiddleware.push(validateBody(replaceValidationSchema));
      else if (validationSchema)
        replaceMiddleware.push(validateBody(validationSchema));
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
        authorize("create"),
        ...createMiddleware,
        asHandler(controller.addOrUpdate),
      );
      subRouter.post(
        "/bulk",
        authorize("bulk"),
        ...bulkMiddleware,
        asHandler(controller.insertMany),
      );
      subRouter.patch(
        "/:id",
        authorize("update"),
        ...updateMiddleware,
        asHandler(controller.update),
      );
      subRouter.put(
        "/:id",
        authorize("replace"),
        ...replaceMiddleware,
        asHandler(controller.replace),
      );
      subRouter.delete(
        "/:id",
        authorize("delete"),
        ...middleWares,
        asHandler(controller.remove),
      );
      subRouter.get(
        "/",
        authorize("read"),
        ...middleWares,
        asHandler(controller.getAll),
      );
      subRouter.get(
        "/:id",
        authorize("read"),
        ...middleWares,
        asHandler(controller.getById),
      );
      router.use(`${prefix}/${path}`, subRouter);
    },
  );
  return router;
};
export default createMaggie;
