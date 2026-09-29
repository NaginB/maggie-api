import { Request, RequestHandler } from "express";
import Joi from "joi";
import { Model } from "mongoose";

export interface ZodSchemaLike<T = unknown> {
  safeParse(value: unknown):
    | { success: true; data: T }
    | {
        success: false;
        error: {
          issues: Array<{ message: string; path: PropertyKey[]; code: string }>;
        };
      };
  partial?: () => ZodSchemaLike<T>;
}
export type ValidationSchema = Joi.ObjectSchema | ZodSchemaLike;

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
  beforeBulk?: MaggieHook;
  afterBulk?: MaggieHook;
}
export interface MaggieChangeEvent extends MaggieHookContext {
  /** `bulk` for insert, update, and delete bulk operations. */
  operation: MaggieOperation;
}
export type MaggieChangeListener = (
  event: MaggieChangeEvent,
) => void | Promise<void>;
export interface MaggieEvents {
  /** Called for every completed mutating operation. */
  onChange?: MaggieChangeListener;
  create?: MaggieChangeListener;
  update?: MaggieChangeListener;
  replace?: MaggieChangeListener;
  delete?: MaggieChangeListener;
  bulk?: MaggieChangeListener;
  /** Compatible with Node-style event emitters. The event name is the operation. */
  emit?: (event: MaggieOperation, payload: MaggieChangeEvent) => unknown;
}
export interface TenantConfig {
  /** Document field that stores the resolved tenant value. */
  field: string;
  resolve: (req: Request) => unknown | Promise<unknown>;
  /** Reject requests without a tenant value. Defaults to true. */
  required?: boolean;
}
export interface CacheContext {
  operation: "list" | "byId" | "invalidate";
  req: Request;
  model: Model<any>;
  id?: string;
}
export interface MaggieCache {
  /** Return undefined for a cache miss. */
  get(key: string): unknown | Promise<unknown>;
  set(key: string, value: unknown): void | Promise<void>;
  /** Called after every successful mutation. */
  invalidate(context: CacheContext): void | Promise<void>;
  /** Builds an application-specific key. Returning undefined bypasses caching. */
  key(context: CacheContext): string | undefined;
}
export interface RelationConfig {
  /** Name used in the nested route, for example `comments`. */
  path: string;
  /** Field on the related model that points to this resource. */
  foreignField: string;
  /** Model to query for the nested resource. */
  model: Model<any>;
  /** Optional population used when returning the nested documents. */
  populate?: PopulateField[];
  /** Optional strict filter policy for this nested route. */
  filter?: FilterConfig;
}
export interface MetadataConfig {
  /** Enables `GET {prefix}/_meta` (or `path`). It is deliberately opt-in. */
  enabled?: boolean;
  path?: string;
  /** Metadata can reveal application structure, so an authorizer is required. */
  authorize: (req: Request) => boolean | Promise<boolean>;
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
  /** Page size used when a list request omits limit. Defaults to 20. */
  defaultLimit?: number;
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
  tenant?: TenantConfig;
  events?: MaggieEvents;
  cache?: MaggieCache;
  relations?: RelationConfig[];
  /** Middleware that runs only for the named generated operation. */
  operationMiddleWares?: Partial<Record<MaggieOperation, RequestHandler[]>>;
  /** Opt-in read and delete routes using a validated alternate document field. */
  lookup?: { key: string; path?: string };
}
export interface MaggieModelPayload {
  model: Model<any>;
  path: string;
  validationSchema?: ValidationSchema;
  updateValidationSchema?: ValidationSchema;
  replaceValidationSchema?: ValidationSchema;
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
  metadata?: MetadataConfig;
}
export interface ISetting extends APISettings {
  getByIdKeys: string[];
  getKeys: string[];
  primaryKey?: string;
}
export type ControllerSettings = ISetting;
