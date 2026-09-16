# API behavior reference

Every normal controller response uses an envelope with `success`, `statusCode`, `message`, and `data`. Validation failures instead include an `error` string; the bulk duplicate-key response also uses `error`.

## Write behavior

| Operation | Success | Important behavior |
| --- | --- | --- |
| Single POST without `_id` | `201` | Calls `model.create`. |
| Single POST with `_id` | `200` | Calls `findByIdAndUpdate` with `{ new: true }`; a missing document returns `404`. |
| Bulk POST | `201` | Requires a non-empty array and calls `insertMany`. |
| Delete | `200` | Calls `findByIdAndDelete`; a missing document returns `404`. |

If `primaryKey` is set and its value is present in a single POST body, the route checks for an existing document before writing and returns `409` when it conflicts. Bulk POST requests reject duplicate supplied, truthy values and values already stored in the database with `409`. A schema-level unique index remains necessary to protect against concurrent writes.

## Read behavior

- List responses use a key derived from the lowercased model name, for example `User` becomes `users`.
- Pagination metadata is included only when both `limit` and `page` are positive integers.
- `GET /:id` returns `404` for a missing document. Invalid ids are also currently reported as `404` by the controller.
- Unsupported filter operators and fields not in the allow-list are ignored.
- Search uses a JavaScript `RegExp` built from the supplied `search` value. It treats the value as a pattern rather than escaping it.

## Known contract considerations

- Mongoose is responsible for casting query values to schema types; query-string values reach the service as strings.
- The package does not catch duplicate-key errors raised directly by MongoDB. Schema indexes should be paired with application error handling where strict conflict responses are required.
- Simple pluralization is implemented locally (`category` to `categories`, `box` to `boxes`); irregular model names are not handled.

Any change to these behaviors is a consumer-facing change and should be accompanied by tests, README updates, and a version decision.
