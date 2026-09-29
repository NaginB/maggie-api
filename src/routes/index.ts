import { randomUUID } from "crypto";
import { Request, RequestHandler, Router } from "express";
import { createController } from "../controllers";
import { getAll } from "../services";
import { ISetting, MaggieOperation, MaggiePayload } from "../utils/interface";
import { sendError } from "../utils/errors";
import {
  optionalValidationSchema,
  validateBody,
  validateBodyField,
} from "../utils/validateBody";

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
          const fields =
            typeof (entry.validationSchema as any)?.describe === "function"
              ? (entry.validationSchema as any).describe().keys || {}
              : {};
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
        res.json({
          success: true,
          statusCode: 200,
          message: "API metadata fetched successfully",
          data: { resources },
        });
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
      const operationMiddleware = (operation: MaggieOperation) =>
        settingsObj.operationMiddleWares?.[operation] || [];
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
      const bulkUpdateMiddleware: RequestHandler[] = [...middleWares];
      if (validationSchema) {
        createMiddleware.push(validateBody(validationSchema));
        bulkMiddleware.push(
          validateBody({
            safeParse: (value: unknown) => {
              if (!Array.isArray(value))
                return {
                  success: false as const,
                  error: {
                    issues: [
                      {
                        message: "must be an array",
                        path: [],
                        code: "array.base",
                      },
                    ],
                  },
                };
              const values: unknown[] = [];
              const issues: any[] = [];
              value.forEach((item, index) => {
                const schema = validationSchema as any;
                const result =
                  typeof schema.safeParse === "function"
                    ? schema.safeParse(item)
                    : schema.validate(item, {
                        abortEarly: false,
                        stripUnknown: true,
                        convert: true,
                      });
                if (result.error) {
                  const details = result.error.issues || result.error.details;
                  issues.push(
                    ...details.map((detail: any) => ({
                      message: detail.message,
                      path: [index, ...(detail.path || [])],
                      code: detail.code || detail.type,
                    })),
                  );
                } else values.push(result.data ?? result.value);
              });
              return issues.length
                ? { success: false as const, error: { issues } }
                : { success: true as const, data: values };
            },
          }),
        );
      }
      if (replaceValidationSchema)
        replaceMiddleware.push(validateBody(replaceValidationSchema));
      else if (validationSchema)
        replaceMiddleware.push(validateBody(validationSchema));
      if (updateValidationSchema)
        updateMiddleware.push(validateBody(updateValidationSchema));
      else if (validationSchema)
        updateMiddleware.push(
          validateBody(optionalValidationSchema(validationSchema)),
        );
      if (updateValidationSchema)
        bulkUpdateMiddleware.push(
          validateBodyField("update", updateValidationSchema),
        );
      else if (validationSchema)
        bulkUpdateMiddleware.push(
          validateBodyField(
            "update",
            optionalValidationSchema(validationSchema),
          ),
        );
      subRouter.post(
        "/",
        authorize("create"),
        ...createMiddleware,
        ...operationMiddleware("create"),
        asHandler(controller.addOrUpdate),
      );
      subRouter.post(
        "/bulk",
        authorize("bulk"),
        ...bulkMiddleware,
        ...operationMiddleware("bulk"),
        asHandler(controller.insertMany),
      );
      if (settingsObj.bulk?.allowUpdate)
        subRouter.patch(
          "/bulk",
          authorize("bulk"),
          ...bulkUpdateMiddleware,
          ...operationMiddleware("bulk"),
          asHandler(controller.bulkUpdate),
        );
      if (settingsObj.bulk?.allowDelete)
        subRouter.delete(
          "/bulk",
          authorize("bulk"),
          ...middleWares,
          ...operationMiddleware("bulk"),
          asHandler(controller.bulkDelete),
        );
      if (settingsObj.lookup) {
        const lookupPath =
          settingsObj.lookup.path || `by-${settingsObj.lookup.key}`;
        subRouter.get(
          `/${lookupPath}/:value`,
          authorize("read"),
          ...middleWares,
          ...operationMiddleware("read"),
          asHandler(controller.getByLookup),
        );
        subRouter.delete(
          `/${lookupPath}/:value`,
          authorize("delete"),
          ...middleWares,
          ...operationMiddleware("delete"),
          asHandler(controller.removeByLookup),
        );
      }
      subRouter.patch(
        "/:id",
        authorize("update"),
        ...updateMiddleware,
        ...operationMiddleware("update"),
        asHandler(controller.update),
      );
      subRouter.put(
        "/:id",
        authorize("replace"),
        ...replaceMiddleware,
        ...operationMiddleware("replace"),
        asHandler(controller.replace),
      );
      subRouter.delete(
        "/:id",
        authorize("delete"),
        ...middleWares,
        ...operationMiddleware("delete"),
        asHandler(controller.remove),
      );
      subRouter.get(
        "/",
        authorize("read"),
        ...middleWares,
        ...operationMiddleware("read"),
        asHandler(controller.getAll),
      );
      for (const relation of settingsObj.relations || []) {
        subRouter.get(
          `/:id/${relation.path}`,
          authorize("read"),
          ...middleWares,
          ...operationMiddleware("read"),
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
        ...operationMiddleware("read"),
        asHandler(controller.getById),
      );
      router.use(`${prefix}/${path}`, subRouter);
    },
  );
  return router;
};
export default createMaggie;
