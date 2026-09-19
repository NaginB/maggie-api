# Migrating from v1 to v2

Version 2 establishes the predictable CRUD and response contract that v3 builds on. It retains the legacy POST-update path by default, so existing consumers can upgrade incrementally rather than changing every client at once.

## Upgrade checklist

1. Update the package reference to the v2-compatible release, run your integration suite, and confirm your Node runtime is 20 or newer.
2. Keep existing `POST /resource` updates working during the transition. When clients are ready, set `settings.legacyPostUpdate: false` and move partial updates to `PATCH /resource/:id`.
3. If an update replaces an entire document, use `PUT /resource/:id`. Supply `replaceValidationSchema` when the replacement contract differs from the create schema.
4. Replace client handling of ad-hoc error shapes with the stable envelope: `success`, `statusCode`, `message`, `data: null`, and `code`. Joi failures include `details` entries with a path and message.
5. Review every list endpoint's `search`, `filter`, `sort`, and pagination configuration. v2 deliberately restricts these operations unless you allow-list fields.

## Route and write changes

| Previous pattern                     | v2 pattern                        | Notes                                                                                          |
| ------------------------------------ | --------------------------------- | ---------------------------------------------------------------------------------------------- |
| `POST /users` with `_id`             | `PATCH /users/:id`                | Preferred partial-update route. POST compatibility remains enabled unless explicitly disabled. |
| Full document overwrite              | `PUT /users/:id`                  | Runs Mongoose validation and returns `404` when the id is missing.                             |
| Missing delete treated as success    | `DELETE /users/:id` returns `404` | Prevents a false successful-delete response.                                                   |
| Duplicate-key errors varied by route | `409 CONFLICT`                    | Applies to pre-flight checks and MongoDB duplicate-key errors.                                 |

`DELETE` returns a body with status `200` by default. Set `deleteStatus: 204` when a no-content response is preferable. Enable `softDelete` if records must remain recoverable; generated reads then omit soft-deleted records.

## Query behavior changes

Search is literal and case-insensitive by default. Search fields, sort fields, filters, regular expressions, logical filter groups, client projections, and client population are opt-in. Configure `allowRegex`, `logicalOperators`, `clientProjection`, and `clientPopulate` only for clients you trust.

Offset pagination remains available with `limit` and `page`. For large or changing result sets, configure `cursorPagination` and start with `?cursor=start`; return the opaque `nextCursor` token unchanged on the next request.

## Response and observability changes

All generated routes return an `x-request-id` response header. Pass an incoming `x-request-id` or configure `requestId` to connect API activity with application logs. Use the injectable `logger` for structured unexpected-error and optional lifecycle audit events.

The list payload key is configurable through `responseKey`. If you relied on model-name pluralization, verify any irregular names in your API clients; v2 uses full English pluralization.

## Moving from v2 to v3

Version 3 keeps the v2 route and response contract. Its new capabilities are opt-in: authorization callbacks and query scopes, policy hooks, field permissions, lifecycle metadata, schema-derived Joi validation, OpenAPI document generation, and configurable bulk behavior. You can adopt these settings resource by resource without changing existing route consumers.

Before publishing an upgrade, run `npm run check`, review the generated OpenAPI document if you expose one, and update callers that depend on a newly enabled permission, scope, projection, population, or bulk-operation setting.
