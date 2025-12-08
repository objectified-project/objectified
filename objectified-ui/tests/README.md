# Tests Directory

This directory contains test files for the Objectified UI utilities.

## Running Tests

The test files in this directory are excluded from the Next.js build process.

### TypeScript DTO Generator Test

To run the TypeScript DTO generator test:

```bash
npx ts-node tests/test-typescript-dto.ts
```

Or with Node.js directly:

```bash
node -r ts-node/register tests/test-typescript-dto.ts
```

## Test Files

- `test-typescript-dto.ts` - Tests the TypeScript DTO generator utility
  - Validates interface generation
  - Tests nested object handling
  - Verifies composition types (allOf, oneOf, anyOf)
  - Checks enum generation
  - Validates required vs optional properties

## Note

These test files are excluded from the TypeScript compilation in `tsconfig.json` to prevent them from being included in the Next.js build process.

