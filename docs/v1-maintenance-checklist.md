# Version 1 maintenance checklist

This checklist records defects and maintenance work identified in the current v1 codebase. Items marked complete were corrected in this repository; the remaining items should be prioritized before a broader public rollout.

## Correctness fixes completed

- [x] Return `404` instead of a successful deletion response when `DELETE /:id` cannot find a document.
- [x] Detect duplicate configured `primaryKey` values within a single bulk request.
- [x] Return `409 Conflict` consistently when a bulk primary-key conflict is found in the request or database.
- [x] Ignore a range-filter field when it contains no supported operator, rather than querying MongoDB with an empty object.
- [x] Require strictly positive integer `limit` and `page` values; malformed values such as `10abc` no longer enable pagination.

## Bugs and behavior to address

- [ ] **Invalid identifier status codes:** distinguish Mongoose `CastError` (`400 Invalid id`) from a valid but missing document (`404`). The current get-by-id controller reports both as `404`; delete reports either as `400` through its catch block.
- [ ] **Database duplicate-key errors:** map MongoDB error code `11000` to a consistent `409` response. Pre-flight checks alone cannot prevent races between concurrent requests.
- [ ] **Update validation:** `findByIdAndUpdate` does not pass `runValidators: true`; Mongoose schema validation can therefore be skipped for updates when no Joi schema is supplied.
- [ ] **Validation error format:** Joi is configured with `abortEarly: false`, so it returns all field errors joined into one string. Decide whether the public contract should expose one message, an array of details, or both, then document it.
- [ ] **Unsafe regular-expression search:** escape user search text by default, limit its length, and optionally introduce an explicit advanced-regex mode. The current implementation creates `RegExp` directly from user input.
- [ ] **Unrestricted sorting:** add an allow-list for sortable fields or a strict-query option. The current `sort` parameter accepts arbitrary model paths.
- [ ] **Pagination limits:** add a configurable maximum `limit` to prevent large, expensive list queries.
- [ ] **Filter type validation:** validate filter operators and values against the model/schema or an explicit config rather than relying solely on Mongoose casting.
- [ ] **Bulk input limits:** set a maximum document count and return structured per-item errors when a bulk write fails.
- [ ] **Pluralization:** replace the local simple pluralizer or let consumers configure the response key. Irregular model names are not handled.

## API consistency improvements

- [ ] Add `PATCH /:id` and make the current POST upsert route an explicit compatibility option.
- [ ] Normalize error envelopes so every error includes `success`, `statusCode`, `message`, `data: null`, and a stable machine-readable `code`.
- [ ] Standardize `400`, `404`, `409`, and `500` behavior across create, update, bulk, read, and delete routes.
- [ ] Add an option to return `204 No Content` after a successful delete, or retain the current body consistently as the documented default.
- [ ] Add request IDs and structured logging hooks; remove direct `console.log` and `console.error` calls from library code or make logging injectable.

## Engineering checklist

- [ ] Add integration tests with MongoDB Memory Server for all routes and query combinations.
- [ ] Add unit tests for `singularToPlural`, query parsing, pagination validation, and Joi middleware.
- [ ] Add CI to run install, build, tests, linting, and package-content checks on supported Node versions.
- [ ] Add ESLint and Prettier, then apply a consistent style to source and documentation.
- [ ] Export all intended configuration and response types from `src/index.ts`.
- [ ] Declare supported Node.js, Express, Mongoose, and Joi version ranges, and verify them in CI.
- [ ] Run `npm pack --dry-run` before publishing to ensure `dist`, declarations, README, and license files ship.

## Documentation checklist

- [x] Replace the corrupted and inaccurate consumer README.
- [x] Add architecture, configuration, API behavior, development, and v2 roadmap documents.
- [ ] Update [API behavior](api-behavior.md) after every response-contract change.
- [ ] Maintain a changelog and a migration note for behavior changes that affect consumers.
