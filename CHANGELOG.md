# Changelog

All notable consumer-facing changes are documented here. For configuration and response details, see the [documentation index](docs/README.md).

## 3.0.0 - 2026-09-19

- Added explicit PUT replacement, soft deletes, cursor pagination, OpenAPI generation, authorization and policy hooks, lifecycle metadata, client projection/population controls, and expanded bulk operations.
- Added field permissions, query scopes, schema-derived Joi validation, advanced allow-listed filters, and structured audit logging.
- Preserved v2 CRUD compatibility while moving the package to the v3 public API surface.

### Upgrade notes

- Node.js 20, 22, and 24 are supported.
- Express 5, Mongoose 8, and Joi 17 are peer dependencies.
- `POST` with `_id` remains enabled for legacy updates by default. Set `settings.legacyPostUpdate: false` to require `PATCH /:id`.
- Review the [migration guide](docs/v2-migration.md) before enabling newly available permissions, scopes, client projection, population, or bulk operations.
