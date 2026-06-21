import assert from "node:assert";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const mustExist = (relative) => {
  const path = join(root, relative);
  assert.ok(existsSync(path), `expected ${relative} to exist`);
};

test("package.json uses @objectified/cli", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  assert.strictEqual(pkg.name, "@objectified/cli");
});

test("run.sh documents usage and forwards to objectified or interactive mode", () => {
  const raw = readFileSync(join(root, "run.sh"), "utf8");
  assert.match(raw, /Usage:/);
  assert.match(raw, /objectified_cli\.run_interactive/);
  assert.match(raw, /exec "\$CLI" "\$@"/);
});

test("package.json defines turborepo scripts", () => {
  const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
  const scripts = pkg.scripts ?? {};
  for (const name of [
    "install:py",
    "build",
    "cli:build",
    "test",
    "cli:test",
    "lint",
    "cli:lint",
    "run",
  ]) {
    assert.ok(scripts[name], `expected scripts.${name} to be defined`);
  }
  assert.match(scripts.test, /pytest tests\//);
  assert.match(scripts.lint, /ruff check src\/ tests\//);
  assert.match(scripts["cli:build"], /install:py/);
  assert.match(scripts["cli:build"], /objectified-cli build complete/);
});

test("pyproject.toml requires Python >= 3.12", () => {
  const raw = readFileSync(join(root, "pyproject.toml"), "utf8");
  assert.match(raw, /requires-python\s*=\s*">=3\.12"/);
});

test("pyproject.toml declares CLI stack dependencies", () => {
  const raw = readFileSync(join(root, "pyproject.toml"), "utf8");
  for (const dep of [
    "typer[all]>=",
    "httpx>=",
    "pydantic-settings>=",
    "py-yaml12>=",
    "jsonschema>=",
    "openapi-spec-validator>=",
  ]) {
    assert.ok(raw.includes(dep), `expected pyproject.toml to include ${dep}`);
  }
});

test("pyproject.toml declares CLI dev dependencies", () => {
  const raw = readFileSync(join(root, "pyproject.toml"), "utf8");
  for (const dep of ["pytest>=", "pytest-httpx>=", "ruff>="]) {
    assert.ok(raw.includes(dep), `expected pyproject.toml to include ${dep}`);
  }
});

test("pyproject.toml registers objectified console script", () => {
  const raw = readFileSync(join(root, "pyproject.toml"), "utf8");
  assert.match(raw, /objectified\s*=\s*"objectified_cli\.main:run"/);
});

test("installed objectified --version prints package version", () => {
  const script = join(root, ".venv", "bin", "objectified");
  assert.ok(existsSync(script), "expected .venv/bin/objectified after uv sync");
  const initPy = readFileSync(
    join(root, "src", "objectified_cli", "__init__.py"),
    "utf8",
  );
  const match = initPy.match(/__version__\s*=\s*"([^"]+)"/);
  assert.ok(match, "expected __version__ in objectified_cli/__init__.py");
  const result = spawnSync(script, ["--version"], { encoding: "utf8" });
  assert.strictEqual(result.status, 0, result.stderr || result.stdout);
  assert.strictEqual(result.stdout.trim(), `objectified ${match[1]}`);
});

test("uv.lock is committed for reproducible installs", () => {
  mustExist("uv.lock");
});

test("expected CLI scaffold paths exist", () => {
  for (const rel of [
    ".gitignore",
    "AGENTS.md",
    "README.md",
    "pyproject.toml",
    "package.json",
    "src/objectified_cli/__init__.py",
    "run.sh",
    "src/objectified_cli/run_interactive.py",
    "src/objectified_cli/main.py",
    "src/objectified_cli/config.py",
    "src/objectified_cli/client/__init__.py",
    "src/objectified_cli/commands/__init__.py",
    "src/objectified_cli/import_/__init__.py",
    "src/objectified_cli/import_/openapi.py",
    "src/objectified_cli/import_/detect.py",
    "src/objectified_cli/import_/json_schema.py",
    "src/objectified_cli/extract/__init__.py",
    "src/objectified_cli/extract/openapi_info.py",
    "tests/test_scaffold.py",
  ]) {
    mustExist(rel);
  }
});

test(".gitignore excludes required patterns", () => {
  const gitignore = readFileSync(join(root, ".gitignore"), "utf8");
  for (const line of [".env", "__pycache__/", ".venv/", "*.pyc", "dist/"]) {
    assert.ok(
      gitignore.split("\n").some((entry) => entry.trim() === line),
      `expected .gitignore to contain ${line}`,
    );
  }
});

test("README documents install, configuration, and examples", () => {
  const raw = readFileSync(join(root, "README.md"), "utf8");
  assert.match(raw, /## Install/i);
  assert.match(raw, /## Configuration/i);
  assert.match(raw, /## Examples/i);
  assert.match(raw, /OBJECTIFIED_BASE_URL/);
  assert.match(raw, /config\.toml/);
  assert.match(raw, /objectified projects list/);
  assert.match(raw, /objectified repos list/);
  assert.match(raw, /objectified repos add --url/);
  assert.match(raw, /objectified repos scan/);
  assert.match(raw, /objectified repos files/);
  assert.match(raw, /objectified repos inspect/);
  assert.match(raw, /objectified repos import/);
  assert.match(raw, /objectified repos imports/);
  assert.match(raw, /objectified import openapi/);
  assert.match(raw, /objectified import arazzo/);
  assert.match(raw, /objectified paths list/);
  assert.match(raw, /objectified operations show/);
  assert.match(raw, /objectified workflows list/);
  assert.match(raw, /import → inspect → export/);
});

test("AGENTS.md documents layout, clig.dev, and REST contract", () => {
  const raw = readFileSync(join(root, "AGENTS.md"), "utf8");
  assert.match(raw, /## Layout/i);
  assert.match(raw, /clig\.dev/i);
  assert.match(raw, /objectified-rest\/openapi\.yaml/);
  assert.match(raw, /yarn cli:test/);
});

test("main.py bootstraps Typer application", () => {
  const raw = readFileSync(
    join(root, "src/objectified_cli/main.py"),
    "utf8",
  );
  assert.match(raw, /app\s*=\s*typer\.Typer/);
  assert.match(raw, /no_args_is_help=False/);
  assert.match(raw, /help_option_names.*-h.*--help/);
});
