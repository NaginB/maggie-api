import { Request, Response } from "express";
import { createDoc, updateDoc, deleteById, getAll, getById } from "../services";
import { Model } from "mongoose";

export const createController = (model: Model<any>) => {
  const modelName = model.modelName;

  return {
    addOrUpdate: async (req: Request, res: Response): Promise<any> => {
      try {
        const { _id, ...rest } = req.body;
        let result;

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
        res.status(500).json({
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
        const result = await getAll(model);

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
        const result = await getById(model, req.params.id);

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
  };
};
