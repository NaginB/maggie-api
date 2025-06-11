import { Request, Response } from "express";
import { createDoc, updateDoc, deleteById, getAll, getById } from "../services";
import { Model } from "mongoose";

export const createController = (model: Model<any>) => ({
  addOrUpdate: async (req: Request, res: Response): Promise<void> => {
    try {
      const { _id, ...rest } = req.body;
      let result;

      if (_id) {
        result = await updateDoc(model, { _id, ...rest });
        if (!result) {
          res.status(404).json({ success: false, error: "Document not found" });
          return;
        }
      } else {
        result = await createDoc(model, rest);
      }

      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  },

  remove: async (req: Request, res: Response) => {
    try {
      const result = await deleteById(model, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(400).json({ success: false, error: error.message });
    }
  },

  getAll: async (_req: Request, res: Response) => {
    try {
      const result = await getAll(model);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(500).json({ success: false, error: error.message });
    }
  },

  getById: async (req: Request, res: Response) => {
    try {
      const result = await getById(model, req.params.id);
      res.status(200).json({ success: true, data: result });
    } catch (error: any) {
      res.status(404).json({ success: false, error: error.message });
    }
  },
});
