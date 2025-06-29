// src/services/index.ts
import { Model } from "mongoose";
import { ISetting } from "../utils/interface";
import { Request } from "express";
import { parse } from "qs";
import { URL } from "url";

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

    // Use qs to parse nested query params like filter[price][gte]
    const url = new URL(req.originalUrl, `http://${req.headers.host}`);
    const queryParams = parse(url.searchParams.toString());

    // 1️⃣ FIELD SELECTION
    if (settings.getKeys?.length) {
      query = query.select(settings.getKeys.join(" "));
    }

    // 2️⃣ FILTERING
    const rawFilter = queryParams.filter as Record<string, any>;
    const allowedFilterFields = settings.get?.filter?.allowedFields || [];

    if (rawFilter && typeof rawFilter === "object") {
      const filterConditions: Record<string, any> = {};

      for (const [field, value] of Object.entries(rawFilter)) {
        if (!allowedFilterFields.includes(field)) continue;

        if (typeof value === "object" && !Array.isArray(value)) {
          const rangeQuery: Record<string, any> = {};
          for (const [op, val] of Object.entries(value)) {
            if (["gte", "lte", "gt", "lt"].includes(op)) {
              rangeQuery[`$${op}`] = val;
            }
          }
          filterConditions[field] = rangeQuery;
        } else if (Array.isArray(value)) {
          filterConditions[field] = { $in: value };
        } else {
          filterConditions[field] = value;
        }
      }

      if (Object.keys(filterConditions).length > 0) {
        query = query.find(filterConditions);
      }
    }

    // 3️⃣ SEARCH
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

      if (searchFieldsFromQuery?.length) {
        finalSearchFields = searchConfig?.allowedFields?.length
          ? searchFieldsFromQuery.filter((field) =>
              searchConfig.allowedFields!.includes(field)
            )
          : searchFieldsFromQuery;
      }

      if (!finalSearchFields.length && searchConfig?.allowedFields?.length) {
        finalSearchFields = searchConfig.allowedFields;
      }

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

    // 4️⃣ POPULATE
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
