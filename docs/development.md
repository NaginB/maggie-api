# Development and release guide

## Prerequisites

- Node.js 20, 22, or 24 (`>=20 <25`).
- npm; use the committed lockfile with `npm ci`.

The supported package ranges are Express `>=5.2.1 <6`, Mongoose `>=8.24.4 <9`, and Joi `>=17.13.8 <18`. CI verifies Node 20, 22, and 24 against both the minimum supported Mongoose 8 release and latest Mongoose 8, and blocks high-severity production dependency advisories.

## Local workflow

```bash
npm ci
npm run check
```

`check` runs formatting verification, ESLint, unit and MongoDB Memory Server integration tests, TypeScript compilation, and `npm pack --dry-run`. Run `npm run format` to apply the repository formatting rules.

## Documentation contract

The package README is the consumer landing page. The `docs/` directory contains task-focused guides and source-of-truth behavior references. When changing public behavior, update the relevant guide, [configuration reference](configuration.md), [response behavior](api-behavior.md), and [changelog](../CHANGELOG.md) in the same pull request.

## Publishing checklist

1. Run `npm ci` followed by `npm run check` on a supported Node version.
2. Confirm the TypeScript declarations in `dist/` expose the intended public types.
3. Review `npm pack --dry-run`; the package should contain `dist/`, `readme.md`, `license`, and `notice.md` only.
4. Update the package version and add a dated changelog entry describing consumer-visible changes.
5. Update the migration guide for any route, response, validation, or security-policy change.
6. Generate and inspect an OpenAPI document if its output changed.

The build emits CommonJS code and declarations in `dist/`. Do not commit generated package archives.
