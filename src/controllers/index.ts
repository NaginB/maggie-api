import { Request, Response } from "express";
import {
  createDoc,
  updateDoc,
  deleteById,
  getAll,
  getById,
  insertMany,
} from "../services";
import { Model } from "mongoose";
import { ControllerSettings } from "utils/interface";

export const createController = (
  model: Model<any>,
  settings: ControllerSettings
) => {
  const modelName = model.modelName;
  const { primaryKey = "" } = settings;
  return {
    addOrUpdate: async (req: Request, res: Response): Promise<any> => {
      try {
        const { _id, ...rest } = req.body;
        let result;

        // ✅ Check uniqueness for primaryKey (only if provided)
        if (primaryKey && rest[primaryKey]) {
          const existing = await model.findOne({
            [primaryKey]: rest[primaryKey],
          });

          if (_id) {
            // ⚠️ Prevent updating to a primary key that exists on another doc
            if (existing && existing._id.toString() !== _id) {
              return res.status(409).json({
                success: false,
                statusCode: 409,
                message: `${modelName} with this ${primaryKey} already exists`,
                data: null,
              });
            }
          } else {
            // ⚠️ Prevent creating if primary key already exists
            if (existing) {
              return res.status(409).json({
                success: false,
                statusCode: 409,
                message: `${modelName} with this ${primaryKey} already exists`,
                data: null,
              });
            }
          }
        }

        if (_id) {
          result = await updateDoc(model, { _id, ...rest });

          if (!result) {
            return res.status(404).json({
              success: false,
              statusCode: 404,
              message: `${modelName} not found`,
              data: null,
            });
          }

          return res.status(200).json({
            success: true,
            statusCode: 200,
            message: `${modelName} updated successfully`,
            data: result,
          });
        }

        result = await createDoc(model, rest);

        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: `${modelName} created successfully`,
          data: result,
        });
      } catch (error: any) {
        console.log(error);
        return res.status(500).json({
          success: false,
          statusCode: 500,
          message: error.message || `Failed to process ${modelName}`,
          data: null,
        });
      }
    },

    remove: async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await deleteById(model, req.params.id);

        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} deleted successfully`,
          data: result,
        });
      } catch (error: any) {
        res.status(400).json({
          success: false,
          statusCode: 400,
          message: error.message,
          data: null,
        });
      }
    },

    getAll: async (_req: Request, res: Response): Promise<any> => {
      try {
        const result = await getAll(model, settings);

        return res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName}s fetched successfully`,
          data: result,
        });
      } catch (error: any) {
        return res.status(500).json({
          success: false,
          statusCode: 500,
          message: error.message,
          data: null,
        });
      }
    },

    getById: async (req: Request, res: Response): Promise<any> => {
      try {
        const result = await getById(model, req.params.id, settings);

        if (!result) {
          return res.status(404).json({
            success: false,
            statusCode: 404,
            message: `${modelName} not found`,
            data: null,
          });
        }

        res.status(200).json({
          success: true,
          statusCode: 200,
          message: `${modelName} fetched successfully`,
          data: result,
        });
      } catch (error: any) {
        res.status(404).json({
          success: false,
          statusCode: 404,
          message: error.message,
          data: null,
        });
      }
    },
    insertMany: async (req: Request, res: Response): Promise<any> => {
      try {
        const docs = req.body;

        if (!Array.isArray(docs) || docs.length === 0) {
          return res.status(400).json({
            success: false,
            statusCode: 400,
            message: "Request body must be a non-empty array of documents",
            data: null,
          });
        }

        //  Check primary key uniqueness
        if (primaryKey) {
          const values = docs.map((doc) => doc[primaryKey]).filter(Boolean);
          const existing = await model.find({ [primaryKey]: { $in: values } });

          if (existing.length > 0) {
            return res.status(400).json({
              success: false,
              statusCode: 400,
              message: `Duplicate ${primaryKey} values`,
              error: existing.map((doc) => doc[primaryKey]),
            });
          }
        }

        const result = await insertMany(model, docs);

        return res.status(201).json({
          success: true,
          statusCode: 201,
          message: `${docs.length} ${modelName}(s) created successfully`,
          data: result,
        });
      } catch (error: any) {
        return res.status(500).json({
          success: false,
          statusCode: 500,
          message: error.message || `Failed to insert ${modelName}s`,
          data: null,
        });
      }
    },
  };
};
