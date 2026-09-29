import { MaggieModelPayload, MaggiePayload } from "./utils/interface";

export interface OpenApiOptions {
  title?: string;
  version?: string;
  description?: string;
}

const schemaFromModel = (model: MaggieModelPayload) => {
  const description =
    typeof (model.validationSchema as any)?.describe === "function"
      ? (model.validationSchema as any).describe()
      : undefined;
  if (!description?.keys) return { type: "object", additionalProperties: true };
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [name, field] of Object.entries(description.keys)) {
    const item = field as any;
    properties[name] = {
      type:
        item.type === "number"
          ? "number"
          : item.type === "boolean"
            ? "boolean"
            : item.type === "array"
              ? "array"
              : "string",
    };
    if (item.flags?.presence === "required") required.push(name);
  }
  return {
    type: "object",
    properties,
    ...(required.length ? { required } : {}),
    additionalProperties: false,
  };
};

const success = (description: string) => ({
  description,
  content: {
    "application/json": { schema: { $ref: "#/components/schemas/Success" } },
  },
});

const errors = {
  "400": { $ref: "#/components/responses/BadRequest" },
  "403": { $ref: "#/components/responses/Forbidden" },
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" },
  "500": { $ref: "#/components/responses/InternalError" },
};

const listParameters = (model: MaggieModelPayload) => {
  const get = model.settings?.get;
  const parameters: Array<Record<string, unknown>> = [
    { name: "search", in: "query", schema: { type: "string" } },
    { name: "searchFields", in: "query", schema: { type: "string" } },
    { name: "caseSensitive", in: "query", schema: { type: "boolean" } },
    {
      name: "filter",
      in: "query",
      style: "deepObject",
      explode: true,
      schema: { type: "object" },
    },
    { name: "sort", in: "query", schema: { type: "string" } },
    { name: "limit", in: "query", schema: { type: "integer", minimum: 1 } },
    { name: "page", in: "query", schema: { type: "integer", minimum: 1 } },
  ];
  if (get?.cursorPagination)
    parameters.push({
      name: "cursor",
      in: "query",
      schema: { type: "string" },
    });
  if (get?.clientProjection)
    parameters.push({
      name: "fields",
      in: "query",
      schema: { type: "string" },
    });
  if (get?.clientPopulate)
    parameters.push({
      name: "populate",
      in: "query",
      schema: { type: "string" },
    });
  return parameters;
};

const bulkUpdateBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["filter", "update"],
        properties: {
          filter: { type: "object" },
          update: { type: "object" },
        },
      },
    },
  },
};

const bulkDeleteBody = {
  required: true,
  content: {
    "application/json": {
      schema: {
        type: "object",
        required: ["filter"],
        properties: { filter: { type: "object" } },
      },
    },
  },
};

/** Builds an OpenAPI 3.1 document from the same configuration passed to createMaggie. */
export const createOpenApiDocument = (
  payload: MaggiePayload,
  options: OpenApiOptions = {},
) => {
  const paths: Record<string, any> = {};
  const schemas: Record<string, unknown> = {};
  for (const model of payload.models) {
    const name = model.model.modelName;
    const collectionPath = `${payload.prefix}/${model.path}`;
    const itemPath = `${collectionPath}/{id}`;
    schemas[name] = schemaFromModel(model);
    const body = {
      required: true,
      content: {
        "application/json": {
          schema: { $ref: `#/components/schemas/${name}` },
        },
      },
    };
    paths[collectionPath] = {
      get: {
        summary: `List ${name}`,
        parameters: listParameters(model),
        responses: { "200": success("Matching documents"), ...errors },
      },
      post: {
        summary: `Create ${name}`,
        requestBody: body,
        responses: { "201": success("Document created"), ...errors },
      },
    };
    const bulkPath: Record<string, unknown> = {
      post: {
        summary: `Create multiple ${name} documents`,
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "array",
                items: { $ref: `#/components/schemas/${name}` },
              },
            },
          },
        },
        responses: { "201": success("Documents created"), ...errors },
      },
    };
    if (model.settings?.bulk?.allowUpdate)
      bulkPath.patch = {
        summary: `Update multiple ${name} documents`,
        requestBody: bulkUpdateBody,
        responses: { "200": success("Documents updated"), ...errors },
      };
    if (model.settings?.bulk?.allowDelete)
      bulkPath.delete = {
        summary: `Delete multiple ${name} documents`,
        requestBody: bulkDeleteBody,
        responses: { "200": success("Documents deleted"), ...errors },
      };
    paths[`${collectionPath}/bulk`] = bulkPath;
    paths[itemPath] = {
      parameters: [
        { name: "id", in: "path", required: true, schema: { type: "string" } },
      ],
      get: {
        summary: `Get ${name}`,
        responses: { "200": success("Document"), ...errors },
      },
      patch: {
        summary: `Update ${name}`,
        requestBody: body,
        responses: { "200": success("Document updated"), ...errors },
      },
      put: {
        summary: `Replace ${name}`,
        requestBody: body,
        responses: { "200": success("Document replaced"), ...errors },
      },
      delete: {
        summary: `Delete ${name}`,
        responses: {
          "200": success("Document deleted"),
          "204": { description: "Document deleted" },
          ...errors,
        },
      },
    };
    for (const relation of model.settings?.relations || []) {
      paths[`${itemPath}/${relation.path}`] = {
        get: {
          summary: `List ${relation.path} for ${name}`,
          parameters: [
            {
              name: "id",
              in: "path",
              required: true,
              schema: { type: "string" },
            },
            ...listParameters({
              ...model,
              settings: { get: { filter: relation.filter } },
            }),
          ],
          responses: { "200": success("Related documents"), ...errors },
        },
      };
    }
  }
  if (payload.metadata && payload.metadata.enabled !== false) {
    const metadataPath = payload.metadata.path || `${payload.prefix}/_meta`;
    paths[metadataPath] = {
      get: {
        summary: "Get API metadata",
        responses: { "200": success("Resource metadata"), ...errors },
      },
    };
  }
  return {
    openapi: "3.1.0",
    info: {
      title: options.title || "Maggie API",
      version: options.version || "3.0.0",
      ...(options.description ? { description: options.description } : {}),
    },
    paths,
    components: {
      schemas: {
        ...schemas,
        Success: {
          type: "object",
          required: ["success", "statusCode", "message", "data"],
        },
        Error: {
          type: "object",
          required: ["success", "statusCode", "message", "data", "code"],
        },
      },
      responses: {
        BadRequest: { description: "Invalid request" },
        Forbidden: { description: "Forbidden" },
        NotFound: { description: "Document not found" },
        Conflict: { description: "Conflicting document" },
        InternalError: { description: "Unexpected server error" },
      },
    },
  };
};
