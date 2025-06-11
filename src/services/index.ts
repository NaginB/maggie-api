// src/services/index.ts
import { Model } from "mongoose";

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

export const getAll = async (model: Model<any>) => {
  return await model.find();
};

export const getById = async (model: Model<any>, id: string) => {
  return await model.findById(id);
};
