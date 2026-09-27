# Development guide

## Prerequisites

- Node.js 20, 22, or 24 (`>=20 <25`).
- npm; use the committed lockfile with `npm ci`.

The supported package ranges are Express `>=5 <6`, Mongoose `>=8 <9`, and Joi `>=17 <18`. CI verifies Node 20, 22, and 24 against both the minimum supported Mongoose 8 release and latest Mongoose 8.

## Local workflow

```bash
npm ci
npm run check
```

`check` runs formatting verification, ESLint, unit and MongoDB Memory Server integration tests, TypeScript compilation, and `npm pack --dry-run`. Run `npm run format` to apply the repository formatting rules.

The build emits CommonJS code and declarations in `dist/`. Before publishing, confirm the pack output contains `dist/`, `readme.md`, `license`, and `notice.md`, update the version, changelog, and migration note.
