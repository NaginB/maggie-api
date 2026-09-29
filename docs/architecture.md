# Architecture

`createMaggie` is a router factory. It receives model definitions, creates an Express sub-router for each model, and mounts it at `${prefix}/${path}`.

The library intentionally separates HTTP policy from database access: routes assemble middleware and authorization, controllers apply resource policy and envelopes, and services build Mongoose queries.

```text
consumer application
  -> createMaggie(payload)
  -> routes/index.ts: route and middleware assembly
  -> controllers/index.ts: HTTP response handling
  -> services/index.ts: Mongoose queries
  -> Mongoose model / MongoDB
```

## Source map

| Path                        | Responsibility                                                                 |
| --------------------------- | ------------------------------------------------------------------------------ |
| `src/index.ts`              | Public exports: `createMaggie` and `MaggiePayload`.                            |
| `src/routes/index.ts`       | Creates routes and combines validation and custom middleware.                  |
| `src/controllers/index.ts`  | Implements CRUD controller actions and response envelopes.                     |
| `src/services/index.ts`     | Performs create, update, delete, list, find-by-id, and bulk-insert operations. |
| `src/utils/interface.ts`    | Configuration interfaces used internally and exported payload type.            |
| `src/utils/validateBody.ts` | Joi validation middleware.                                                     |
| `src/utils/common.ts`       | Response-key pluralization helper.                                             |

## Request flow

1. Express matches the configured model sub-route.
2. The router assigns an `x-request-id`, then `middleWares`, authorization, and validation run for the matched operation.
3. A controller applies field permissions, tenant data, query scopes, lifecycle metadata, hooks, events, caching, and the response envelope.
4. The service executes the Mongoose query. List queries apply selection, filtering, search, population, sorting, and pagination.
5. Successful mutations emit events, invalidate configured caches, and may write audit entries through the injected logger.

## Change boundaries

- Add a route or change route order in `src/routes/index.ts`.
- Change HTTP status codes, messages, or error handling in `src/controllers/index.ts`.
- Change query semantics in `src/services/index.ts`; update the API behavior document and README query table in the same change.
- Change public configuration in `src/utils/interface.ts`, then update `configuration.md` and export types deliberately from `src/index.ts` if consumers need them.

The repository has Vitest unit tests and MongoDB Memory Server integration tests. Add or update coverage before changing query parsing, validation, or response contracts.
