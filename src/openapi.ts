import { MaggieModelPayload, MaggiePayload } from "./utils/interface";

export interface OpenApiOptions {
  title?: string;
  version?: string;
  description?: string;
}

const schemaFromModel = (model: MaggieModelPayload) => {
  const description = model.validationSchema?.describe();
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
  "404": { $ref: "#/components/responses/NotFound" },
  "409": { $ref: "#/components/responses/Conflict" },
  "500": { $ref: "#/components/responses/InternalError" },
};

/** Builds an OpenAPI 3.1 document from the same configuration passed to createMaggie. */
export const createOpenApiDocument = (
  payload: MaggiePayload,
  options: OpenApiOptions = {},
) => {
  const paths: Record<string, unknown> = {};
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
        parameters: [
          { name: "search", in: "query", schema: { type: "string" } },
          { name: "sort", in: "query", schema: { type: "string" } },
          {
            name: "limit",
            in: "query",
            schema: { type: "integer", minimum: 1 },
          },
          {
            name: "page",
            in: "query",
            schema: { type: "integer", minimum: 1 },
          },
        ],
        responses: { "200": success("Matching documents"), ...errors },
      },
      post: {
        summary: `Create ${name}`,
        requestBody: body,
        responses: { "201": success("Document created"), ...errors },
      },
    };
    paths[`${collectionPath}/bulk`] = {
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
        NotFound: { description: "Document not found" },
        Conflict: { description: "Conflicting document" },
        InternalError: { description: "Unexpected server error" },
      },
    },
  };
};
