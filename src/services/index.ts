// src/services/index.ts
import { Model } from "mongoose";
import { ISetting } from "../utils/interface";

export const createDoc = async (model: Model<any>, data: any) => {
  return await model.create(data);
};

export const updateDoc = async (model: Model<any>, data: any) => {
  if (!data._id) throw new Error("Missing _id for update");
  return await model.findByIdAndUpdate(data._id, data, { new: true });
};

export const deleteById = async (model: Model<any>, id: string) => {
  return await model.findByIdAndDelete(id);
};

export const getAll = async (model: Model<any>, settings: ISetting) => {
  try {
    let query = model.find();

    // Apply field selection if keys are specified
    if (settings.getKeys?.length) {
      query = query.select(settings.getKeys.join(" "));
    }

    // Apply population if specified
    if (settings.get?.populate?.length) {
      for (const pop of settings.get.populate) {
        query = query.populate(pop);
      }
    }

    const results = await query.exec();
    return results;
  } catch (error) {
    console.error("Error in getAll:", error);
    throw error;
  }
};

export const getById = async (
  model: Model<any>,
  id: string,
  settings: ISetting
) => {
  try {
    let query = model.findById(id);

    // Select specific fields
    if (settings.getByIdKeys?.length) {
      query = query.select(settings.getByIdKeys.join(" "));
    }

    // Populate fields if defined
    if (settings.getById?.populate?.length) {
      for (const pop of settings.getById.populate) {
        query = query.populate(pop);
      }
    }

    const result = await query.exec();
    return result;
  } catch (error) {
    console.error("Error in getById:", error);
    throw error;
  }
};

// 🔹 insertMany service
export const insertMany = async (model: Model<any>, docs: any[]) => {
  if (!Array.isArray(docs)) {
    throw new Error("insertMany expects an array of documents");
  }
  return await model.insertMany(docs);
};
