import { Request } from "express";
import { Model, Types } from "mongoose";
import { parse } from "qs";
import { URL } from "url";
import { escapeRegex, singularToPlural } from "../utils/common";
import { HttpError } from "../utils/errors";
import { FilterValueType, ISetting } from "../utils/interface";

export const createDoc = (model: Model<any>, data: any) => model.create(data);
export const updateDoc = (model: Model<any>, id: string, data: any) =>
  model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
export const deleteById = (model: Model<any>, id: string) =>
  model.findByIdAndDelete(id);
export const insertMany = (model: Model<any>, docs: any[]) =>
  model.insertMany(docs);

const castValue = (
  value: unknown,
  type: FilterValueType | undefined,
  field: string,
): unknown => {
  if (!type || type === "string") return String(value);
  if (type === "number") {
    const result = Number(value);
    if (!Number.isFinite(result))
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Invalid number for filter field ${field}`,
      );
    return result;
  }
  if (type === "boolean") {
    if (value !== "true" && value !== "false" && typeof value !== "boolean")
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Invalid boolean for filter field ${field}`,
      );
    return value === true || value === "true";
  }
  if (type === "date") {
    const result = new Date(String(value));
    if (Number.isNaN(result.getTime()))
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Invalid date for filter field ${field}`,
      );
    return result;
  }
  if (!Types.ObjectId.isValid(String(value)))
    throw new HttpError(
      400,
      "QUERY_ERROR",
      `Invalid ObjectId for filter field ${field}`,
    );
  return new Types.ObjectId(String(value));
};
export const parsePositiveInteger = (value: unknown): number | undefined => {
  if (typeof value !== "string" || !/^[1-9]\d*$/.test(value)) return undefined;
  const number = Number(value);
  return Number.isSafeInteger(number) ? number : undefined;
};

export const getAll = async (
  model: Model<any>,
  settings: ISetting,
  req: Request,
) => {
  let query = model.find();
  const url = new URL(
    req.originalUrl,
    `http://${req.headers.host || "localhost"}`,
  );
  const queryParams = parse(url.searchParams.toString());
  if (settings.getKeys.length) query = query.select(settings.getKeys.join(" "));
  const rawFilter = queryParams.filter;
  const filterConfig = settings.get?.filter;
  const configuredFields = filterConfig?.fields || {};
  const allowedFields = new Set(
    filterConfig?.allowedFields || Object.keys(configuredFields),
  );
  const conditions: Record<string, any> = {};
  if (rawFilter && typeof rawFilter === "object" && !Array.isArray(rawFilter)) {
    for (const [field, raw] of Object.entries(rawFilter)) {
      if (!allowedFields.has(field)) {
        if (filterConfig?.strict)
          throw new HttpError(
            400,
            "QUERY_ERROR",
            `Filter field ${field} is not allowed`,
          );
        continue;
      }
      const config = configuredFields[field];
      const operators = new Set(
        config?.operators || ["eq", "in", "gte", "lte", "gt", "lt"],
      );
      if (Array.isArray(raw)) {
        if (!operators.has("in"))
          throw new HttpError(
            400,
            "QUERY_ERROR",
            `Operator in is not allowed for ${field}`,
          );
        conditions[field] = {
          $in: raw.map((value) => castValue(value, config?.type, field)),
        };
      } else if (raw && typeof raw === "object") {
        const range: Record<string, unknown> = {};
        for (const [op, value] of Object.entries(raw)) {
          if (
            !["gte", "lte", "gt", "lt"].includes(op) ||
            !operators.has(op as any)
          ) {
            if (filterConfig?.strict)
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Operator ${op} is not allowed for ${field}`,
              );
            continue;
          }
          range[`$${op}`] = castValue(value, config?.type, field);
        }
        if (Object.keys(range).length) conditions[field] = range;
      } else {
        if (!operators.has("eq"))
          throw new HttpError(
            400,
            "QUERY_ERROR",
            `Operator eq is not allowed for ${field}`,
          );
        conditions[field] = castValue(raw, config?.type, field);
      }
    }
  }
  if (Object.keys(conditions).length) query = query.find(conditions);
  const keyword = queryParams.search;
  const searchConfig = settings.get?.search;
  if (
    searchConfig?.disabled !== true &&
    typeof keyword === "string" &&
    keyword.trim()
  ) {
    const maxLength = searchConfig?.maxLength ?? 100;
    if (keyword.length > maxLength)
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Search must not exceed ${maxLength} characters`,
      );
    const requested =
      typeof queryParams.searchFields === "string"
        ? queryParams.searchFields
            .split(",")
            .map((field) => field.trim())
            .filter(Boolean)
        : [];
    const allowed = searchConfig?.allowedFields || [];
    const fields = requested.length
      ? requested.filter((field) => allowed.includes(field))
      : allowed;
    if (fields.length) {
      let regex: RegExp;
      try {
        regex = new RegExp(
          searchConfig?.allowRegex ? keyword : escapeRegex(keyword),
          queryParams.caseSensitive === "true" ? "" : "i",
        );
      } catch {
        throw new HttpError(
          400,
          "QUERY_ERROR",
          "Invalid search regular expression",
        );
      }
      query = query.find({ $or: fields.map((field) => ({ [field]: regex })) });
    }
  }
  for (const populate of settings.get?.populate || [])
    query = query.populate(populate);
  if (typeof queryParams.sort === "string" && queryParams.sort) {
    const allowed = new Set(settings.get?.sort?.allowedFields || []);
    const strict = settings.get?.sort?.strict !== false;
    const sort: Record<string, 1 | -1> = {};
    for (const token of queryParams.sort
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean)) {
      const field = token.startsWith("-") ? token.slice(1) : token;
      if (!allowed.has(field)) {
        if (strict)
          throw new HttpError(
            400,
            "QUERY_ERROR",
            `Sort field ${field} is not allowed`,
          );
        continue;
      }
      sort[field] = token.startsWith("-") ? -1 : 1;
    }
    if (Object.keys(sort).length) query = query.sort(sort);
  }
  const requestedLimit = parsePositiveInteger(queryParams.limit);
  const page = parsePositiveInteger(queryParams.page);
  const maxLimit = settings.get?.maxLimit ?? 100;
  if (requestedLimit && requestedLimit > maxLimit)
    throw new HttpError(
      400,
      "QUERY_ERROR",
      `limit must not exceed ${maxLimit}`,
    );
  let pagination;
  let results;
  if (requestedLimit && page) {
    const total = await model.countDocuments(query.getQuery());
    results = await query
      .skip((page - 1) * requestedLimit)
      .limit(requestedLimit)
      .exec();
    pagination = {
      total,
      page,
      limit: requestedLimit,
      totalPages: Math.ceil(total / requestedLimit),
    };
  } else results = await query.exec();
  const responseKey =
    settings.responseKey || singularToPlural(model.modelName.toLowerCase());
  return pagination
    ? { [responseKey]: results, pagination }
    : { [responseKey]: results };
};
export const getById = async (
  model: Model<any>,
  id: string,
  settings: ISetting,
) => {
  let query = model.findById(id);
  if (settings.getByIdKeys.length)
    query = query.select(settings.getByIdKeys.join(" "));
  for (const populate of settings.getById?.populate || [])
    query = query.populate(populate);
  return query.exec();
};
