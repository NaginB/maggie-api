# Project documentation

This directory is the maintainer reference for `maggie-api`.

- [Architecture](architecture.md) explains the request flow and source layout.
- [Configuration](configuration.md) documents the public `createMaggie` payload.
- [API behavior](api-behavior.md) records routes, response shapes, and current edge cases.
- [Development](development.md) describes local build and release checks.
- [Version 2 roadmap](v2-roadmap.md) prioritizes future product and engineering work.
- [Version 1 maintenance checklist](v1-maintenance-checklist.md) tracks known defects and hardening work.
- [V1 maintenance migration note](v1-migration.md) explains the compatible behavior changes.
- [`CHANGELOG.md`](../CHANGELOG.md) records release-facing changes.

Keep these documents aligned with source changes. The package README is the consumer-facing entry point; this directory carries the implementation detail that would otherwise be easy to lose.
