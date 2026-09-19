import { Request } from "express";
import { Model, Types } from "mongoose";
import { parse } from "qs";
import { URL } from "url";
import { escapeRegex, singularToPlural } from "../utils/common";
import { HttpError } from "../utils/errors";
import {
  FilterConfig,
  FilterValueType,
  ISetting,
  SoftDeleteConfig,
} from "../utils/interface";

export const createDoc = (model: Model<any>, data: any) => model.create(data);
export const updateDoc = (model: Model<any>, id: string, data: any) =>
  model.findByIdAndUpdate(id, data, { new: true, runValidators: true });
export const replaceDoc = (model: Model<any>, id: string, data: any) =>
  model.findOneAndReplace({ _id: id }, data, {
    new: true,
    runValidators: true,
  });
export const deleteById = (model: Model<any>, id: string) =>
  model.findByIdAndDelete(id);
export const bulkUpdate = (model: Model<any>, filter: any, update: any) =>
  model.updateMany(filter, update, { runValidators: true });
export const bulkDelete = (model: Model<any>, filter: any) =>
  model.deleteMany(filter);
export const softDeleteById = (
  model: Model<any>,
  id: string,
  softDelete: SoftDeleteConfig,
  deletedBy: unknown,
) => {
  const deletedAt = softDelete.deletedAt || "deletedAt";
  const update: Record<string, unknown> = { [deletedAt]: new Date() };
  if (softDelete.deletedBy && deletedBy !== undefined)
    update[softDelete.deletedBy] = deletedBy;
  return model.findByIdAndUpdate(id, update, {
    new: true,
    runValidators: true,
  });
};
export const insertMany = async (
  model: Model<any>,
  docs: any[],
  options: { ordered?: boolean; atomic?: boolean } = {},
) => {
  if (!options.atomic)
    return model.insertMany(docs, { ordered: options.ordered ?? true });
  const session = await model.db.startSession();
  try {
    let result: any[] = [];
    await session.withTransaction(async () => {
      result = await model.insertMany(docs, {
        ordered: options.ordered ?? true,
        session,
      });
    });
    return result;
  } finally {
    await session.endSession();
  }
};

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

const activeDocumentCondition = (softDelete?: SoftDeleteConfig) => {
  if (!softDelete) return {};
  const field = softDelete.deletedAt || "deletedAt";
  return { $or: [{ [field]: { $exists: false } }, { [field]: null }] };
};

const encodeCursor = (value: unknown, id: unknown) =>
  Buffer.from(JSON.stringify({ value, id: String(id) })).toString("base64url");
const decodeCursor = (token: string): { value: unknown; id: string } => {
  try {
    const decoded = JSON.parse(Buffer.from(token, "base64url").toString());
    if (!decoded || typeof decoded.id !== "string") throw new Error();
    return decoded;
  } catch {
    throw new HttpError(400, "QUERY_ERROR", "Invalid cursor");
  }
};

const buildFilterConditions = (
  rawFilter: unknown,
  filterConfig: FilterConfig | undefined,
  depth = 0,
): Record<string, any> => {
  if (!rawFilter || typeof rawFilter !== "object" || Array.isArray(rawFilter))
    return {};
  if (depth > 3)
    throw new HttpError(400, "QUERY_ERROR", "Filter nesting is too deep");
  const configuredFields = filterConfig?.fields || {};
  const allowedFields = new Set(
    filterConfig?.allowedFields || Object.keys(configuredFields),
  );
  const conditions: Record<string, any> = {};
  for (const [field, raw] of Object.entries(rawFilter)) {
    if (field === "$and" || field === "$or") {
      const operator = field.slice(1) as "and" | "or";
      if (!filterConfig?.logicalOperators?.includes(operator))
        throw new HttpError(
          400,
          "QUERY_ERROR",
          `Logical operator ${field} is not allowed`,
        );
      if (!Array.isArray(raw) || !raw.length)
        throw new HttpError(
          400,
          "QUERY_ERROR",
          `Logical operator ${field} requires a non-empty array`,
        );
      conditions[field] = raw.map((item) =>
        buildFilterConditions(item, filterConfig, depth + 1),
      );
      continue;
    }
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
      continue;
    }
    if (raw && typeof raw === "object") {
      const range: Record<string, unknown> = {};
      for (const [op, value] of Object.entries(raw)) {
        if (!operators.has(op as any)) {
          if (filterConfig?.strict)
            throw new HttpError(
              400,
              "QUERY_ERROR",
              `Operator ${op} is not allowed for ${field}`,
            );
          continue;
        }
        if (["gte", "lte", "gt", "lt", "ne"].includes(op))
          range[`$${op}`] = castValue(value, config?.type, field);
        else if (op === "nin")
          range.$nin = (Array.isArray(value) ? value : [value]).map((item) =>
            castValue(item, config?.type, field),
          );
        else if (op === "exists") {
          if (value !== "true" && value !== "false")
            throw new HttpError(
              400,
              "QUERY_ERROR",
              `Invalid exists value for ${field}`,
            );
          range.$exists = value === "true";
        } else if (op === "regex") {
          if (!config?.allowRegex)
            throw new HttpError(
              400,
              "QUERY_ERROR",
              `Regex filters are not enabled for ${field}`,
            );
          try {
            range.$regex = new RegExp(String(value));
          } catch {
            throw new HttpError(
              400,
              "QUERY_ERROR",
              `Invalid regular expression for ${field}`,
            );
          }
        }
      }
      if (Object.keys(range).length) conditions[field] = range;
      continue;
    }
    if (!operators.has("eq"))
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Operator eq is not allowed for ${field}`,
      );
    conditions[field] = castValue(raw, config?.type, field);
  }
  return conditions;
};

export const getAll = async (
  model: Model<any>,
  settings: ISetting,
  req: Request,
) => {
  const scope = await settings.queryScope?.(req, "read");
  let query = model.find({
    ...activeDocumentCondition(settings.softDelete),
    ...(scope || {}),
  });
  const url = new URL(
    req.originalUrl,
    `http://${req.headers.host || "localhost"}`,
  );
  const queryParams = parse(url.searchParams.toString());
  const readable = settings.permissions?.readable || settings.getKeys;
  if (readable.length) query = query.select(readable.join(" "));
  const projection = settings.get?.clientProjection;
  const requestedFields =
    typeof queryParams.fields === "string"
      ? queryParams.fields
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean)
      : [];
  if (requestedFields.length) {
    if (
      !projection ||
      requestedFields.some((field) => !projection.allowedFields.includes(field))
    )
      throw new HttpError(
        400,
        "QUERY_ERROR",
        "A requested projection field is not allowed",
      );
    if (
      requestedFields.length >
      (projection.maxFields ?? projection.allowedFields.length)
    )
      throw new HttpError(
        400,
        "QUERY_ERROR",
        "Too many projection fields requested",
      );
    query = query.select(requestedFields.join(" "));
  }
  const rawFilter = queryParams.filter;
  const filterConfig = settings.permissions?.filterable
    ? {
        ...settings.get?.filter,
        allowedFields: settings.permissions.filterable,
      }
    : settings.get?.filter;
  const configuredFields = filterConfig?.fields || {};
  const allowedFields = new Set(
    settings.permissions?.filterable ||
      filterConfig?.allowedFields ||
      Object.keys(configuredFields),
  );
  const conditions: Record<string, any> = {};
  const groupedConditions = buildFilterConditions(rawFilter, filterConfig);
  if (rawFilter && typeof rawFilter === "object" && !Array.isArray(rawFilter)) {
    for (const [field, raw] of Object.entries(rawFilter)) {
      if (field === "$and" || field === "$or") {
        conditions[field] = groupedConditions[field];
        continue;
      }
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
          if (!operators.has(op as any)) {
            if (filterConfig?.strict)
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Operator ${op} is not allowed for ${field}`,
              );
            continue;
          }
          if (["gte", "lte", "gt", "lt", "ne"].includes(op))
            range[`$${op}`] = castValue(value, config?.type, field);
          else if (op === "nin")
            range.$nin = (Array.isArray(value) ? value : [value]).map((item) =>
              castValue(item, config?.type, field),
            );
          else if (op === "exists") {
            if (value !== "true" && value !== "false")
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Invalid exists value for ${field}`,
              );
            range.$exists = value === "true";
          } else if (op === "regex") {
            if (!config?.allowRegex)
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Regex filters are not enabled for ${field}`,
              );
            try {
              range.$regex = new RegExp(String(value));
            } catch {
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Invalid regular expression for ${field}`,
              );
            }
          } else {
            if (filterConfig?.strict)
              throw new HttpError(
                400,
                "QUERY_ERROR",
                `Operator ${op} is not allowed for ${field}`,
              );
          }
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
    const allowed =
      settings.permissions?.searchable || searchConfig?.allowedFields || [];
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
  const configuredPopulate = settings.get?.populate || [];
  const requestedPopulate =
    typeof queryParams.populate === "string"
      ? queryParams.populate
          .split(",")
          .map((path) => path.trim())
          .filter(Boolean)
      : [];
  const population = settings.get?.clientPopulate;
  if (requestedPopulate.length && !population)
    throw new HttpError(400, "QUERY_ERROR", "Client population is not enabled");
  if (requestedPopulate.length > (population?.maxPaths ?? 0))
    throw new HttpError(
      400,
      "QUERY_ERROR",
      "Too many population paths requested",
    );
  for (const path of requestedPopulate.length
    ? requestedPopulate
    : configuredPopulate.map((item) => item.path)) {
    if (requestedPopulate.length && !population?.allowedPaths.includes(path))
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `Population path ${path} is not allowed`,
      );
    if (
      requestedPopulate.length &&
      path.split(".").length > (population?.maxDepth ?? 1)
    )
      throw new HttpError(
        400,
        "QUERY_ERROR",
        "Population depth exceeds the configured maximum",
      );
    query = query.populate(
      configuredPopulate.find((item) => item.path === path) || { path },
    );
  }
  if (typeof queryParams.sort === "string" && queryParams.sort) {
    const allowed = new Set(
      settings.permissions?.sortable || settings.get?.sort?.allowedFields || [],
    );
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
  const cursorConfig = settings.get?.cursorPagination;
  const cursor = queryParams.cursor;
  let pagination;
  let cursorPagination;
  let results;
  if (typeof cursor === "string") {
    if (!cursorConfig)
      throw new HttpError(
        400,
        "QUERY_ERROR",
        "Cursor pagination is not enabled",
      );
    const limit =
      requestedLimit || Math.min(cursorConfig.maxLimit ?? maxLimit, 20);
    const cursorMax = Math.min(cursorConfig.maxLimit ?? maxLimit, maxLimit);
    if (limit > cursorMax)
      throw new HttpError(
        400,
        "QUERY_ERROR",
        `limit must not exceed ${cursorMax} for cursor pagination`,
      );
    const direction = cursorConfig.direction === "desc" ? -1 : 1;
    if (cursor !== "start") {
      const decoded = decodeCursor(cursor);
      const value = castValue(
        decoded.value,
        cursorConfig.type,
        cursorConfig.field,
      );
      const comparison = direction === 1 ? "$gt" : "$lt";
      query = query.find({
        $and: [
          {
            $or: [
              { [cursorConfig.field]: { [comparison]: value } },
              {
                [cursorConfig.field]: value,
                _id: { [comparison]: new Types.ObjectId(decoded.id) },
              },
            ],
          },
        ],
      });
    }
    const pageResults = await query
      .sort({ [cursorConfig.field]: direction, _id: direction })
      .limit(limit + 1)
      .exec();
    const hasNextPage = pageResults.length > limit;
    results = hasNextPage ? pageResults.slice(0, limit) : pageResults;
    const last = results[results.length - 1] as any;
    cursorPagination = {
      limit,
      nextCursor:
        hasNextPage && last
          ? encodeCursor(last.get(cursorConfig.field), last._id)
          : null,
    };
  } else if (requestedLimit && page) {
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
    : cursorPagination
      ? { [responseKey]: results, cursorPagination }
      : { [responseKey]: results };
};
export const getById = async (
  model: Model<any>,
  id: string,
  settings: ISetting,
  req: Request,
) => {
  const scope = await settings.queryScope?.(req, "read");
  let query = model.findOne({
    _id: id,
    ...activeDocumentCondition(settings.softDelete),
    ...(scope || {}),
  });
  const readable = settings.permissions?.readable || settings.getByIdKeys;
  if (readable.length) query = query.select(readable.join(" "));
  for (const populate of settings.getById?.populate || [])
    query = query.populate(populate);
  return query.exec();
};
