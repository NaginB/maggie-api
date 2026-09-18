import { Request, RequestHandler } from "express";
import Joi from "joi";
import { Model } from "mongoose";

export type ErrorCode =
  | "VALIDATION_ERROR"
  | "INVALID_ID"
  | "NOT_FOUND"
  | "CONFLICT"
  | "QUERY_ERROR"
  | "BULK_LIMIT_EXCEEDED"
  | "INTERNAL_ERROR";
export interface ApiResponse<T = unknown> {
  success: boolean;
  statusCode: number;
  message: string;
  data: T | null;
  code?: ErrorCode;
  details?: unknown;
  requestId?: string;
}
export interface PopulateField {
  path: string;
  select?: string[];
  populate?: PopulateField[];
}
export interface SearchConfig {
  disabled?: boolean;
  allowedFields?: string[];
  maxLength?: number;
  allowRegex?: boolean;
}
export type FilterOperator = "eq" | "in" | "gte" | "lte" | "gt" | "lt";
export type FilterValueType =
  "string" | "number" | "boolean" | "date" | "objectId";
export interface FilterFieldConfig {
  type?: FilterValueType;
  operators?: FilterOperator[];
}
export interface FilterConfig {
  allowedFields?: string[];
  fields?: Record<string, FilterFieldConfig>;
  strict?: boolean;
}
export interface SortConfig {
  allowedFields?: string[];
  strict?: boolean;
}
export interface ListSettings {
  populate?: PopulateField[];
  keys?: string[];
  filter?: FilterConfig;
  search?: SearchConfig;
  sort?: SortConfig;
  maxLimit?: number;
}
export interface APISettings {
  get?: ListSettings;
  getById?: { populate?: PopulateField[]; keys?: string[] };
  responseKey?: string;
  maxBulkSize?: number;
  legacyPostUpdate?: boolean;
  deleteStatus?: 200 | 204;
}
export interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: Joi.ObjectSchema;
  updateValidationSchema?: Joi.ObjectSchema;
  primaryKey?: string;
  middleWares?: RequestHandler[];
  settings?: APISettings;
  /** @deprecated Use settings.getById.keys instead. */ getByIdKeys?: string[];
  /** @deprecated Use settings.get.keys instead. */ getKeys?: string[];
}
export interface MaggieLogEntry {
  level: "error" | "warn" | "info";
  message: string;
  requestId?: string;
  method?: string;
  path?: string;
  error?: unknown;
}
export interface MaggieLogger {
  error?(entry: MaggieLogEntry): void;
  warn?(entry: MaggieLogEntry): void;
  info?(entry: MaggieLogEntry): void;
}
export interface MaggiePayload {
  prefix: string;
  models: MaggieModelPayload[];
  requestId?: (req: Request) => string | undefined;
  logger?: MaggieLogger;
}
export interface ISetting extends APISettings {
  getByIdKeys: string[];
  getKeys: string[];
  primaryKey?: string;
}
export type ControllerSettings = ISetting;
