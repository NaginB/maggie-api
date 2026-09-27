import { randomUUID } from "crypto";
import { Request, RequestHandler, Router } from "express";
import Joi from "joi";
import { createController } from "../controllers";
import { getAll } from "../services";
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
  metadata,
}: MaggiePayload): Router => {
  const router = Router();
  router.use((req, res, next) => {
    const id = requestId?.(req) || req.header("x-request-id") || randomUUID();
    (req as Request & { maggieRequestId?: string }).maggieRequestId = id;
    res.setHeader("x-request-id", id);
    next();
  });
  if (metadata && metadata.enabled !== false) {
    router.get(metadata.path || `${prefix}/_meta`, async (req, res, next) => {
      try {
        if (!(await metadata.authorize(req)))
          return void sendError(req, res, 403, "FORBIDDEN", "Forbidden");
        const resources = models.map((entry) => {
          const settings = entry.settings || {};
          const fields = entry.validationSchema?.describe().keys || {};
          return {
            name: entry.model.modelName,
            path: `${prefix}/${entry.path}`,
            fields: Object.fromEntries(
              Object.entries(fields).map(([name, field]: [string, any]) => [
                name,
                {
                  type: field.type,
                  required: field.flags?.presence === "required",
                },
              ]),
            ),
            operations: [
              "create",
              "read",
              "update",
              "replace",
              "delete",
              "bulk",
            ].filter(
              (operation) =>
                operation !== "bulk" ||
                settings.bulk?.allowUpdate ||
                settings.bulk?.allowDelete ||
                true,
            ),
            permissions: settings.permissions || {},
            filters: settings.get?.filter || {},
            sorting: settings.get?.sort || {},
            pagination: {
              maxLimit: settings.get?.maxLimit ?? 100,
              cursor: settings.get?.cursorPagination || null,
            },
            relations: (settings.relations || []).map((relation) => ({
              path: relation.path,
              foreignField: relation.foreignField,
            })),
          };
        });
        res.json({ success: true, statusCode: 200, data: { resources } });
        return;
      } catch (error) {
        next(error);
      }
    });
  }
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
      if (settingsObj.bulk?.allowUpdate)
        subRouter.patch(
          "/bulk",
          authorize("bulk"),
          ...middleWares,
          asHandler(controller.bulkUpdate),
        );
      if (settingsObj.bulk?.allowDelete)
        subRouter.delete(
          "/bulk",
          authorize("bulk"),
          ...middleWares,
          asHandler(controller.bulkDelete),
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
      for (const relation of settingsObj.relations || []) {
        subRouter.get(
          `/:id/${relation.path}`,
          authorize("read"),
          ...middleWares,
          async (req, res, next) => {
            try {
              const relatedSettings: ISetting = {
                getByIdKeys: [],
                getKeys: [],
                ...(relation.filter
                  ? {
                      get: {
                        filter: relation.filter,
                        populate: relation.populate,
                      },
                    }
                  : { get: { populate: relation.populate } }),
              };
              const result = await getAll(
                relation.model,
                relatedSettings,
                req,
                { [relation.foreignField]: req.params.id },
              );
              res.status(200).json({
                success: true,
                statusCode: 200,
                message: `${relation.model.modelName} fetched successfully`,
                data: result,
              });
              return;
            } catch (error) {
              next(error);
            }
          },
        );
      }
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
