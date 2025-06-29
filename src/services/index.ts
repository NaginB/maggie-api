// src/services/index.ts
import { Model } from "mongoose";
import { ISetting } from "../utils/interface";
import { Request } from "express";

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
  settings: ISetting,
  req: Request
) => {
  try {
    let query = model.find();
    const queryParams = req.query;

    // 🔍 SEARCH
    const searchKeyword = queryParams.search as string;
    const caseSensitive = queryParams.caseSensitive === "true";
    const searchFieldsFromQuery = (queryParams.searchFields as string)
      ?.split(",")
      .map((f) => f.trim());

    const searchConfig = settings.get?.search;
    const isSearchDisabled = searchConfig?.disabled === true;

    if (
      !isSearchDisabled &&
      typeof searchKeyword === "string" &&
      searchKeyword.trim()
    ) {
      let finalSearchFields: string[] = [];

      //  If query param provided → filter it by allowedFields (if any)
      if (searchFieldsFromQuery?.length) {
        finalSearchFields = searchConfig?.allowedFields?.length
          ? searchFieldsFromQuery.filter((field) =>
              searchConfig.allowedFields!.includes(field)
            )
          : searchFieldsFromQuery;
      }

      //  If no query param → use allowedFields directly (if any)
      if (!finalSearchFields.length && searchConfig?.allowedFields?.length) {
        finalSearchFields = searchConfig.allowedFields;
      }

      //  If we have fields, apply regex search
      if (finalSearchFields.length) {
        const regex = new RegExp(searchKeyword, caseSensitive ? "" : "i");
        const searchConditions = finalSearchFields.map((field) => ({
          [field]: regex,
        }));
        query = query.find({ $or: searchConditions });
      } else {
        console.warn("⚠️ Search skipped: No valid searchable fields found.");
      }
    }

    //  FIELD SELECTION
    if (settings.getKeys?.length) {
      query = query.select(settings.getKeys.join(" "));
    }

    //  POPULATE
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
