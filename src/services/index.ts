// src/services/index.ts
import { Model } from "mongoose";
import { ControllerSettings } from "utils/inteface";

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

export const getAll = async (
  model: Model<any>,
  settings: ControllerSettings
) => {
  console.log("join: ", settings.getKeys.join(" "));
  return settings.getKeys.length
    ? await model.find().select(settings.getKeys.join(" "))
    : await model.find();
};

export const getById = async (
  model: Model<any>,
  id: string,
  settings: ControllerSettings
) => {
  return settings.getByIdKeys?.length
    ? await model.findById(id).select(settings.getByIdKeys.join(" "))
    : await model.findById(id);
};
