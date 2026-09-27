import { Request, Response } from "express";
import { Model } from "mongoose";
import {
  createDoc,
  bulkDelete,
  bulkUpdate,
  deleteById,
  getAll,
  getById,
  insertMany,
  replaceDoc,
  softDeleteById,
  updateDoc,
} from "../services";
import { handleError, HttpError, sendError } from "../utils/errors";
import {
  ControllerSettings,
  MaggieLogger,
  MaggieOperation,
} from "../utils/interface";

export const createController = (
  model: Model<any>,
  settings: ControllerSettings,
  logger?: MaggieLogger,
) => {
  const modelName = model.modelName;
  const tenantScope = async (req: Request) => {
    const tenant = settings.tenant;
    if (!tenant) return {};
    const value = await tenant.resolve(req);
    if ((value === undefined || value === null) && tenant.required !== false)
      throw new HttpError(403, "FORBIDDEN", "Tenant could not be resolved");
    return value === undefined || value === null
      ? {}
      : { [tenant.field]: value };
  };
  const tenantData = async (req: Request, body: any, create = false) => {
    const tenant = settings.tenant;
    if (!tenant) return body;
    const scope = await tenantScope(req);
    const value = scope[tenant.field];
    if (!create && Object.prototype.hasOwnProperty.call(body, tenant.field))
      throw new HttpError(403, "FORBIDDEN", "Tenant field cannot be changed");
    if (
      create &&
      body[tenant.field] !== undefined &&
      String(body[tenant.field]) !== String(value)
    )
      throw new HttpError(
        403,
        "FORBIDDEN",
        "Tenant field does not match request tenant",
      );
    return create && value !== undefined
      ? { ...body, [tenant.field]: value }
      : body;
  };
  const mutationScope = async (
    req: Request,
    operation: "update" | "replace" | "delete",
  ) => ({
    ...(await settings.queryScope?.(req, operation)),
    ...(await tenantScope(req)),
  });
  const emitChange = async (
    operation: MaggieOperation,
    req: Request,
    input?: any,
    document?: unknown,
  ) => {
    const event = { operation, req, model, input, document };
    const events = settings.events;
    await events?.onChange?.(event);
    await (events as Record<string, any> | undefined)?.[operation]?.(event);
    events?.emit?.(operation, event);
  };
  const invalidate = async (req: Request) =>
    settings.cache?.invalidate({ operation: "invalidate", req, model });
  const runHook = async (
    name: keyof NonNullable<ControllerSettings["hooks"]>,
    req: Request,
    operation: any,
    input?: any,
    document?: unknown,
  ) => settings.hooks?.[name]?.({ operation, req, model, input, document });
  const lifecycleData = (req: Request, body: any, create = false) => {
    const lifecycle = settings.lifecycle;
    const actor = lifecycle?.getActor?.(req);
    if (!lifecycle) return body;
    const now = new Date();
    return {
      ...body,
      ...(create && lifecycle.createdBy
        ? { [lifecycle.createdBy]: actor }
        : {}),
      ...(lifecycle.updatedBy ? { [lifecycle.updatedBy]: actor } : {}),
      ...(create && lifecycle.createdAt ? { [lifecycle.createdAt]: now } : {}),
      ...(lifecycle.updatedAt ? { [lifecycle.updatedAt]: now } : {}),
    };
  };
  const audit = (req: Request, action: string) => {
    if (!settings.lifecycle?.audit) return;
    logger?.info?.({
      level: "info",
      message: `${modelName} ${action}`,
      requestId: req.header("x-request-id") || undefined,
      method: req.method,
      path: req.originalUrl,
    });
  };
  const writableData = (body: any) => {
    const writable = settings.permissions?.writable;
    if (!writable) return body;
    const forbidden = Object.keys(body).filter(
      (field) => field !== "_id" && !writable.includes(field),
    );
    if (forbidden.length)
      throw new HttpError(
        403,
        "FORBIDDEN",
        `Write fields are not allowed: ${forbidden.join(", ")}`,
      );
    return body;
  };
  const conflict = (req: Request, res: Response) =>
    sendError(
      req,
      res,
      409,
      "CONFLICT",
      `${modelName} with this ${settings.primaryKey} already exists`,
    );
  const checkPrimaryKey = async (
    req: Request,
    res: Response,
    body: any,
    id?: string,
  ): Promise<boolean> => {
    const key = settings.primaryKey;
    if (!key || body[key] === undefined || body[key] === null) return false;
    const existing = await model.findOne({
      [key]: body[key],
      ...(await tenantScope(req)),
    });
    if (existing && (!id || String(existing._id) !== id)) {
      conflict(req, res);
      return true;
    }
    return false;
  };
  const update = async (req: Request, res: Response, id: string, body: any) => {
    body = writableData(body);
    body = await tenantData(req, body);
    body = lifecycleData(req, body);
    await runHook("beforeUpdate", req, "update", body);
    if (await checkPrimaryKey(req, res, body, id)) return;
    const result = await updateDoc(
      model,
      id,
      body,
      await mutationScope(req, "update"),
    );
    if (!result)
      return sendError(req, res, 404, "NOT_FOUND", `${modelName} not found`);
    await runHook("afterUpdate", req, "update", body, result);
    await emitChange("update", req, body, result);
    await invalidate(req);
    audit(req, "updated");
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: `${modelName} updated successfully`,
      data: result,
    });
  };
  const replace = async (
    req: Request,
    res: Response,
    id: string,
    body: any,
  ) => {
    body = writableData(body);
    body = await tenantData(req, body);
    body = lifecycleData(req, body);
    await runHook("beforeUpdate", req, "replace", body);
    if (await checkPrimaryKey(req, res, body, id)) return;
    const result = await replaceDoc(
      model,
      id,
      body,
      await mutationScope(req, "replace"),
    );
    if (!result)
      return sendError(req, res, 404, "NOT_FOUND", `${modelName} not found`);
    await runHook("afterUpdate", req, "replace", body, result);
    await emitChange("replace", req, body, result);
    await invalidate(req);
    audit(req, "replaced");
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: `${modelName} replaced successfully`,
      data: result,
    });
  };
  return {
    bulkUpdate: async (req: Request, res: Response) => {
      try {
        const { filter, update } = req.body || {};
        if (!filter || !update)
          return sendError(
            req,
            res,
            400,
            "VALIDATION_ERROR",
            "filter and update are required",
          );
        const input = await tenantData(req, writableData(update));
        await runHook("beforeBulk", req, "bulk", { filter, update: input });
        const result = await bulkUpdate(
          model,
          filter,
          input,
          await mutationScope(req, "update"),
        );
        await runHook(
          "afterBulk",
          req,
          "bulk",
          { filter, update: input },
          result,
        );
        await emitChange("bulk", req, { filter, update: input }, result);
        await invalidate(req);
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} documents updated`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    bulkDelete: async (req: Request, res: Response) => {
      try {
        const { filter } = req.body || {};
        if (!filter)
          return sendError(
            req,
            res,
            400,
            "VALIDATION_ERROR",
            "filter is required",
          );
        await runHook("beforeBulk", req, "bulk", { filter });
        const result = await bulkDelete(
          model,
          filter,
          await mutationScope(req, "delete"),
        );
        await runHook("afterBulk", req, "bulk", { filter }, result);
        await emitChange("bulk", req, { filter }, result);
        await invalidate(req);
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} documents deleted`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    addOrUpdate: async (req: Request, res: Response) => {
      try {
        const { _id, ...body } = req.body;
        if (_id) {
          if (settings.legacyPostUpdate === false)
            return sendError(
              req,
              res,
              400,
              "VALIDATION_ERROR",
              "POST updates are disabled; use PATCH /:id",
            );
          return await update(req, res, String(_id), body);
        }
        const input = lifecycleData(
          req,
          await tenantData(req, writableData(body), true),
          true,
        );
        await runHook("beforeCreate", req, "create", input);
        if (await checkPrimaryKey(req, res, input)) return;
        const result = await createDoc(model, input);
        await runHook("afterCreate", req, "create", input, result);
        await emitChange("create", req, input, result);
        await invalidate(req);
        audit(req, "created");
        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: `${modelName} created successfully`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    update: async (req: Request, res: Response) => {
      try {
        return await update(req, res, req.params.id, req.body);
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    replace: async (req: Request, res: Response) => {
      try {
        return await replace(req, res, req.params.id, req.body);
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    remove: async (req: Request, res: Response) => {
      try {
        await runHook("beforeDelete", req, "delete");
        const result = settings.softDelete
          ? await softDeleteById(
              model,
              req.params.id,
              settings.softDelete,
              settings.softDelete.getDeletedBy?.(req),
              await mutationScope(req, "delete"),
            )
          : await deleteById(
              model,
              req.params.id,
              await mutationScope(req, "delete"),
            );
        if (!result)
          return sendError(
            req,
            res,
            404,
            "NOT_FOUND",
            `${modelName} not found`,
          );
        await runHook("afterDelete", req, "delete", undefined, result);
        await emitChange("delete", req, undefined, result);
        await invalidate(req);
        audit(req, "deleted");
        if (settings.deleteStatus === 204) return res.status(204).send();
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} deleted successfully`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    getAll: async (req: Request, res: Response) => {
      try {
        const cache = settings.cache;
        const key = cache?.key({ operation: "list", req, model });
        const cached = key ? await cache?.get(key) : undefined;
        const result =
          cached === undefined
            ? await getAll(model, settings, req, await tenantScope(req))
            : cached;
        if (key && cached === undefined) await cache?.set(key, result);
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName}s fetched successfully`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    getById: async (req: Request, res: Response) => {
      try {
        const cache = settings.cache;
        const key = cache?.key({
          operation: "byId",
          req,
          model,
          id: req.params.id,
        });
        const cached = key ? await cache?.get(key) : undefined;
        const result =
          cached === undefined
            ? await getById(
                model,
                req.params.id,
                {
                  ...settings,
                  queryScope: async (request) => ({
                    ...(await settings.queryScope?.(request, "read")),
                    ...(await tenantScope(request)),
                  }),
                },
                req,
              )
            : cached;
        if (key && cached === undefined && result)
          await cache?.set(key, result);
        if (!result)
          return sendError(
            req,
            res,
            404,
            "NOT_FOUND",
            `${modelName} not found`,
          );
        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} fetched successfully`,
          data: result,
        });
      } catch (error) {
        return handleError(req, res, error, logger);
      }
    },
    insertMany: async (req: Request, res: Response) => {
      try {
        const docs = req.body;
        if (!Array.isArray(docs) || !docs.length)
          return sendError(
            req,
            res,
            400,
            "VALIDATION_ERROR",
            "Request body must be a non-empty array of documents",
          );
        const maximum = settings.maxBulkSize ?? 100;
        if (docs.length > maximum)
          return sendError(
            req,
            res,
            413,
            "BULK_LIMIT_EXCEEDED",
            `Bulk requests must not exceed ${maximum} documents`,
          );
        if (settings.primaryKey) {
          const key = settings.primaryKey;
          const values: any[] = docs
            .map((doc: any) => doc[key])
            .filter((value: unknown) => value !== undefined && value !== null);
          const duplicates = [
            ...new Set(
              values.filter(
                (value: unknown, index: number) =>
                  values.indexOf(value) !== index,
              ),
            ),
          ];
          if (duplicates.length)
            return sendError(
              req,
              res,
              409,
              "CONFLICT",
              `Duplicate ${key} values in request body`,
              { values: duplicates },
            );
          const existing = values.length
            ? await model.find({
                [key]: { $in: values },
                ...(await tenantScope(req)),
              })
            : [];
          if (existing.length)
            return sendError(
              req,
              res,
              409,
              "CONFLICT",
              `Duplicate ${key} values`,
              { values: existing.map((doc: any) => doc[key]) },
            );
        }
        const input = await Promise.all(
          docs.map((doc: any) => tenantData(req, writableData(doc), true)),
        );
        await runHook("beforeBulk", req, "bulk", input);
        const result = await insertMany(model, input, settings.bulk);
        await runHook("afterBulk", req, "bulk", input, result);
        await emitChange("bulk", req, input, result);
        await invalidate(req);
        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: `${docs.length} ${modelName}(s) created successfully`,
          data: result,
        });
      } catch (error: any) {
        const details = Array.isArray(error?.writeErrors)
          ? error.writeErrors.map((item: any) => ({
              index: item.index,
              code: item.code,
              message: item.errmsg || item.message,
            }))
          : undefined;
        if (details) error.details = details;
        return handleError(req, res, error, logger);
      }
    },
  };
};
