import { Request, Response } from "express";
import { Model } from "mongoose";
import {
  createDoc,
  deleteById,
  getAll,
  getById,
  insertMany,
  updateDoc,
} from "../services";
import { handleError, sendError } from "../utils/errors";
import { ControllerSettings, MaggieLogger } from "../utils/interface";

export const createController = (
  model: Model<any>,
  settings: ControllerSettings,
  logger?: MaggieLogger,
) => {
  const modelName = model.modelName;
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
    const existing = await model.findOne({ [key]: body[key] });
    if (existing && (!id || String(existing._id) !== id)) {
      conflict(req, res);
      return true;
    }
    return false;
  };
  const update = async (req: Request, res: Response, id: string, body: any) => {
    if (await checkPrimaryKey(req, res, body, id)) return;
    const result = await updateDoc(model, id, body);
    if (!result)
      return sendError(req, res, 404, "NOT_FOUND", `${modelName} not found`);
    return res.status(200).json({
      success: true,
      statusCode: 200,
      message: `${modelName} updated successfully`,
      data: result,
    });
  };
  return {
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
        if (await checkPrimaryKey(req, res, body)) return;
        const result = await createDoc(model, body);
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
    remove: async (req: Request, res: Response) => {
      try {
        const result = await deleteById(model, req.params.id);
        if (!result)
          return sendError(
            req,
            res,
            404,
            "NOT_FOUND",
            `${modelName} not found`,
          );
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
        const result = await getAll(model, settings, req);
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
        const result = await getById(model, req.params.id, settings);
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
            ? await model.find({ [key]: { $in: values } })
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
        const result = await insertMany(model, docs);
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
