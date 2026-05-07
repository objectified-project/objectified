# objectified-cli

TypeScript CLI for [Objectified](https://objectified.dev), built with [oclif](https://oclif.io/) v4.

## Requirements

- Node.js 20+

## Install (monorepo / local)

From this directory:

```bash
npm install -g .
# or
npm link
```

The `objectified` binary should be on your `PATH`.

## Development

```bash
yarn install   # from repo root
yarn workspace objectified-cli build
yarn workspace objectified-cli dev hello
yarn workspace objectified-cli test
```

The workspace root pins `ansi-regex`, `string-width`, and `strip-ansi` so oclif’s help layout (`widest-line` / `wrap-ansi`) always resolves CommonJS-compatible builds under Yarn’s hoisting.

## Commands

| Command              | Description         |
| -------------------- | ------------------- |
| `objectified hello`  | Smoke-test greeting |
| `objectified --help` | Built-in help       |

Configuration defaults use `OBJECTIFIED_BASE_URL` when set; otherwise `https://api.objectified.dev`. Full flag and config semantics land in roadmap tickets #3187–#3188.

## Performance

`objectified --version` and `objectified --help` are sized for sub‑200 ms cold start on typical developer hardware (see integration test budgets).
