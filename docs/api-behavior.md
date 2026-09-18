# API behavior reference

All responses use an envelope. Successful responses contain `success`, `statusCode`, `message`, and `data`. Every error has `success: false`, `statusCode`, `message`, `data: null`, and a stable `code`; validation and bulk-write errors may also include `details`. A generated `x-request-id` response header is included on every route and is echoed in an error body when present.

| Code                  | Status | Meaning                                                                                    |
| --------------------- | ------ | ------------------------------------------------------------------------------------------ |
| `VALIDATION_ERROR`    | 400    | Joi or Mongoose validation failed. Joi `details` is an array of `{ message, path, type }`. |
| `INVALID_ID`          | 400    | Mongoose could not cast a path id.                                                         |
| `QUERY_ERROR`         | 400    | A strict filter/sort/query rule was violated.                                              |
| `NOT_FOUND`           | 404    | The id is valid but no document exists.                                                    |
| `CONFLICT`            | 409    | A pre-flight or MongoDB duplicate-key (`11000`) conflict occurred.                         |
| `BULK_LIMIT_EXCEEDED` | 413    | The bulk array exceeds `maxBulkSize`.                                                      |
| `INTERNAL_ERROR`      | 500    | An unexpected server failure.                                                              |

## Write behavior

| Operation     | Success    | Important behavior                                                                         |
| ------------- | ---------- | ------------------------------------------------------------------------------------------ |
| `POST /`      | 201        | Creates a document. With `_id`, performs legacy update unless `legacyPostUpdate: false`.   |
| `PATCH /:id`  | 200        | Partial update with Mongoose `runValidators: true`; missing document is 404.               |
| `POST /bulk`  | 201        | Requires a non-empty array within `maxBulkSize`; rejects configured primary-key conflicts. |
| `DELETE /:id` | 200 or 204 | Missing document is 404. Set `deleteStatus: 204` for no response body.                     |

A Mongoose unique index remains the database-level guarantee. MongoDB duplicate-key errors—including races after a pre-flight check—are normalized to `409 CONFLICT`.

## List query behavior

- Pagination activates only when both `limit` and `page` are strictly positive integers. `limit` may not exceed `settings.get.maxLimit` (default `100`).
- Search is literal and case-insensitive by default. Search text is escaped and limited to `search.maxLength` (default `100`). Set `search.allowRegex: true` only for trusted advanced-regex clients.
- Filtering is opt-in. `filter.fields` defines field types and allowed operators; values are cast before querying. With `filter.strict: true`, an unknown field or operator returns `400`.
- Sorting is allow-listed by `sort.allowedFields`. It rejects unlisted fields by default; set `sort.strict: false` to ignore them instead.
- The list response key uses `settings.responseKey` when configured. Otherwise it uses full English pluralization of the lowercase model name.

Any response or query behavior change is consumer-facing: add coverage, update this page and `readme.md`, and add an entry to the changelog and migration note.
