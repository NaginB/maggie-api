# Project documentation

This directory is the maintainer reference for `maggie-api`.

- [Architecture](architecture.md) explains the request flow and source layout.
- [Configuration](configuration.md) documents the public `createMaggie` payload.
- [API behavior](api-behavior.md) records routes, response shapes, and current edge cases.
- [Development](development.md) describes local build and release checks.
- [Version 3 roadmap](v3-roadmap.md) prioritizes future product and engineering work.
- [Version 2 maintenance checklist](v2-maintenance-checklist.md) tracks completed defects and hardening work.
- [V1-to-v2 migration guide](v2-migration.md) explains the compatible behavior changes and upgrade path.
- [`CHANGELOG.md`](../CHANGELOG.md) records release-facing changes.

Keep these documents aligned with source changes. The package README is the consumer-facing entry point; this directory carries the implementation detail that would otherwise be easy to lose.
