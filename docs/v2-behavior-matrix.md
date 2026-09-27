# V2 behavior matrix

This is the published compatibility contract retained by v3. The integration suite exercises the cases named in the final column.

| Area                     | Contract                                                                                                              | Integration coverage                                               |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Response envelope        | Every success has `success`, `statusCode`, `message`, and `data`; every failure has `data: null` and a stable `code`. | CRUD, validation, invalid-id, conflict, and missing-resource cases |
| Create and legacy update | `POST /resource` creates with `201`; a body containing `_id` updates with `200` unless `legacyPostUpdate: false`.     | CRUD lifecycle and legacy-update case                              |
| Standard writes          | PATCH is partial, PUT replaces, and a missing document returns `404`.                                                 | CRUD lifecycle case                                                |
| Delete                   | DELETE returns `200` with its envelope by default, `204` when configured, and `404` when absent.                      | CRUD, no-content, and soft-delete cases                            |
| List safety              | Search, filter, sort, and pagination are allow-listed and malformed values are rejected.                              | Safe search, typed-filter, sort, offset, and cursor cases          |
| Bulk create              | A non-empty bounded array is required; request and database primary-key conflicts return `409`.                       | Bulk-limit, validation, conflict, and race cases                   |
| Errors                   | Invalid object ids return `400 INVALID_ID`; duplicate keys return `409 CONFLICT`.                                     | Invalid-id and conflict cases                                      |
| Observability            | Each generated route supplies `x-request-id`; configured middleware retains its order.                                | Request-id and middleware-order case                               |

The authoritative test file is [`tests/integration/routes.test.ts`](../tests/integration/routes.test.ts). Any change to a matrix row must update that suite, [API behavior](api-behavior.md), and the migration guide before release.
