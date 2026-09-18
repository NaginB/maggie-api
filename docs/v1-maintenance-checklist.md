# Version 1 maintenance checklist

This checklist records defects and maintenance work identified in the current v1 codebase. Items marked complete were corrected in this repository; the remaining items should be prioritized before a broader public rollout.

## Correctness fixes completed

- [x] Return `404` instead of a successful deletion response when `DELETE /:id` cannot find a document.
- [x] Detect duplicate configured `primaryKey` values within a single bulk request.
- [x] Return `409 Conflict` consistently when a bulk primary-key conflict is found in the request or database.
- [x] Ignore a range-filter field when it contains no supported operator, rather than querying MongoDB with an empty object.
- [x] Require strictly positive integer `limit` and `page` values; malformed values such as `10abc` no longer enable pagination.

## Bugs and behavior addressed

- [x] **Invalid identifier status codes:** `CastError` returns `400 INVALID_ID`; a valid missing id returns `404 NOT_FOUND`.
- [x] **Database duplicate-key errors:** MongoDB error `11000` maps to `409 CONFLICT`.
- [x] **Update validation:** updates pass `runValidators: true` and support an optional PATCH Joi schema.
- [x] **Validation error format:** errors expose a stable message and a structured `details` array.
- [x] **Unsafe regular-expression search:** search is escaped and length-limited by default, with explicit `allowRegex` opt-in.
- [x] **Unrestricted sorting:** sorting requires an allow-list and has an explicit strictness setting.
- [x] **Pagination limits:** `maxLimit` is configurable and defaults to 100.
- [x] **Filter type validation:** explicit filter types and operator allow-lists validate query values.
- [x] **Bulk input limits:** `maxBulkSize` bounds requests; validation and write details are structured.
- [x] **Pluralization:** full English pluralization is used and `responseKey` is configurable.

## API consistency improvements

- [x] Add `PATCH /:id` and make the current POST upsert route an explicit compatibility option.
- [x] Normalize error envelopes so every error includes `success`, `statusCode`, `message`, `data: null`, and a stable machine-readable `code`.
- [x] Standardize `400`, `404`, `409`, and `500` behavior across create, update, bulk, read, and delete routes.
- [x] Add an option to return `204 No Content` after a successful delete, or retain the current body consistently as the documented default.
- [x] Add request IDs and structured logging hooks; remove direct `console.log` and `console.error` calls from library code or make logging injectable.

## Engineering checklist

- [x] Add integration tests with MongoDB Memory Server for all routes and query combinations.
- [x] Add unit tests for `singularToPlural`, query parsing, pagination validation, and Joi middleware.
- [x] Add CI to run install, build, tests, linting, and package-content checks on supported Node versions.
- [x] Add ESLint and Prettier, then apply a consistent style to source and documentation.
- [x] Export all intended configuration and response types from `src/index.ts`.
- [x] Declare supported Node.js, Express, Mongoose, and Joi version ranges, and verify them in CI.
- [x] Run `npm pack --dry-run` before publishing to ensure `dist`, declarations, README, and license files ship.

## Documentation checklist

- [x] Replace the corrupted and inaccurate consumer README.
- [x] Add architecture, configuration, API behavior, development, and v2 roadmap documents.
- [x] Update [API behavior](api-behavior.md) after every response-contract change.
- [x] Maintain a changelog and a migration note for behavior changes that affect consumers.
