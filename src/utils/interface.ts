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
  | "FORBIDDEN"
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
export type FilterOperator =
  "eq" | "ne" | "in" | "nin" | "exists" | "regex" | "gte" | "lte" | "gt" | "lt";
export type FilterValueType =
  "string" | "number" | "boolean" | "date" | "objectId";
export interface FilterFieldConfig {
  type?: FilterValueType;
  operators?: FilterOperator[];
  /** Permits `regex`; literal matching remains the default. */
  allowRegex?: boolean;
}
export interface FilterConfig {
  allowedFields?: string[];
  fields?: Record<string, FilterFieldConfig>;
  strict?: boolean;
  /** Explicitly permits `filter[$and]` and/or `filter[$or]` query groups. */
  logicalOperators?: Array<"and" | "or">;
}
export interface SortConfig {
  allowedFields?: string[];
  strict?: boolean;
}
export interface CursorPaginationConfig {
  /** Stable field used to order cursor pages. */
  field: string;
  type?: FilterValueType;
  direction?: "asc" | "desc";
  maxLimit?: number;
}
export interface ClientProjectionConfig {
  allowedFields: string[];
  maxFields?: number;
}
export interface ClientPopulateConfig {
  allowedPaths: string[];
  maxPaths?: number;
  maxDepth?: number;
}
export interface SoftDeleteConfig {
  /** Field that stores the deletion time. Defaults to `deletedAt`. */
  deletedAt?: string;
  /** Optional field that records the deleting actor. */
  deletedBy?: string;
  /** Resolves the actor value for `deletedBy` from the current request. */
  getDeletedBy?: (req: Request) => unknown;
}
export type MaggieOperation =
  "create" | "read" | "update" | "replace" | "delete" | "bulk";
export interface MaggieHookContext {
  operation: MaggieOperation;
  req: Request;
  model: Model<any>;
  input?: Record<string, unknown> | Array<Record<string, unknown>>;
  document?: unknown;
}
export type MaggieHook = (context: MaggieHookContext) => void | Promise<void>;
export interface MaggieHooks {
  beforeCreate?: MaggieHook;
  afterCreate?: MaggieHook;
  beforeUpdate?: MaggieHook;
  afterUpdate?: MaggieHook;
  beforeDelete?: MaggieHook;
  afterDelete?: MaggieHook;
}
export type MaggieAuthorizer = (
  req: Request,
  operation: MaggieOperation,
) => boolean | Promise<boolean>;
export interface FieldPermissions {
  readable?: string[];
  writable?: string[];
  filterable?: string[];
  sortable?: string[];
  searchable?: string[];
}
export interface LifecycleMetadataConfig {
  createdBy?: string;
  updatedBy?: string;
  createdAt?: string;
  updatedAt?: string;
  audit?: boolean;
  getActor?: (req: Request) => unknown;
}
export interface BulkConfig {
  ordered?: boolean;
  atomic?: boolean;
  allowUpdate?: boolean;
  allowDelete?: boolean;
}
export interface ListSettings {
  populate?: PopulateField[];
  keys?: string[];
  filter?: FilterConfig;
  search?: SearchConfig;
  sort?: SortConfig;
  maxLimit?: number;
  cursorPagination?: CursorPaginationConfig;
  clientProjection?: ClientProjectionConfig;
  clientPopulate?: ClientPopulateConfig;
}
export interface APISettings {
  get?: ListSettings;
  getById?: { populate?: PopulateField[]; keys?: string[] };
  responseKey?: string;
  maxBulkSize?: number;
  legacyPostUpdate?: boolean;
  deleteStatus?: 200 | 204;
  softDelete?: SoftDeleteConfig;
  hooks?: MaggieHooks;
  authorize?: Partial<Record<MaggieOperation, MaggieAuthorizer>>;
  permissions?: FieldPermissions;
  lifecycle?: LifecycleMetadataConfig;
  bulk?: BulkConfig;
  queryScope?: (
    req: Request,
    operation: "read" | "update" | "replace" | "delete",
  ) => Record<string, unknown> | Promise<Record<string, unknown>>;
}
export interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: Joi.ObjectSchema;
  updateValidationSchema?: Joi.ObjectSchema;
  replaceValidationSchema?: Joi.ObjectSchema;
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
