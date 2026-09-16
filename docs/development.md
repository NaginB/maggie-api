# Development guide

## Prerequisites

- Node.js compatible with the dependencies in `package.json`.
- npm (the committed `package-lock.json` is the dependency lockfile).

## Local workflow

```bash
npm ci
npm run build
```

The build compiles TypeScript from `src/` to `dist/` and emits declaration files. `dist/` is the package runtime entry point, so run a clean build before publishing.

## Validation checklist

Before releasing:

1. Run `npm run build` with no TypeScript errors.
2. Exercise each generated route against a real Mongoose model, including invalid ids and duplicate primary keys.
3. Test list selection, filters, search, sorting, pagination, and population where changed.
4. Check the packed artifact with `npm pack --dry-run`; confirm `dist/`, the README, and license are present.
5. Update the package version and consumer documentation for behavior changes.

## Documentation ownership

- Update `readme.md` when installing, configuring, or consuming the package changes.
- Update `docs/api-behavior.md` for status-code, response-shape, or query-semantic changes.
- Update `docs/architecture.md` for source-layout or request-flow changes.

There is currently no test runner in the npm scripts. Adding focused integration tests is the highest-value improvement for future changes.
