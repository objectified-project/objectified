---
name: handle-ticket
description: Fetches the GitHub Issue for the current repo, implements it on branch ticket-<n>, tests, pushes, opens a PR with Copilot as reviewer, then returns to main.
---

# Implement (`/implement <number>`)

When user invokes **implement** with issue number (for example `/implement 124`), treat that number as the **GitHub issue** in the **current repository** (e.g. `KenSuenobu/objectified` for this workspace). Follow workflow end to end unless user stops you or environment blocks a step (auth, permissions, missing `gh`, etc.).

## Phase 1 - Fetch issue

1. Identify current repository from workspace context.
2. Fetch full issue **title, body, labels, and any linked/previous discussion** needed to understand scope:

```
gh issue view <number> --repo <owner>/<repo>
```

3. Summarize issue clearly in the conversation so full intent is in context.
4. **NEVER invent requirements.**  If issue is **ambiguous, underspecified, or contradicts the codebase**, ask concise clarifying questions before proceeding.

## Phase 2 - Branch setup

1. Fetch and checkout latest default branch:

```bash
git fetch origin
git checkout main
git pull origin main
```

2. Create and switch to `ticket-<number>`:

```bash
git checkout -b ticket-<number>
```

3. If branch already exists, report it and ask whether to reset or reuse it.
4. All implementation commits for this ticket belong on this branch.

## Phase 3 - Implementation

- Apply **CLAUDE.md** / **copilot-instructions.md** and other workspace rules (tests, version bumps, no edits to reference-only trees, etc.).
- If Context7 MCP available, use it to query for latest documentation regarding frameworks and standards.
- Implement behavior **as specified in the issue**.
- If change is **large or risky**, outline a short plan in chat and wait for alignment before proceeding.
- Split code into separate modules, helper functions, or utility classes if context becomes too large or unmanageable.
- Keep implementation **simple** - simpler the better, making code easy to read and understand.
- Create **comprehensive test cases** for all new and changed functionality.
- Don't Repeat Yourself.

## Phase 4 - Internal Audit

After coding changes are made, perform an internal audit before moving on:

- Ensure potential misuses of new code are safeguarded and covered.
- Verify colors and positioning use **Tailwind CSS classes** - no hard-coded values.
- Documentation must be well-written and succinct.
- Check for code reuse opportunities; extract repeated logic into separate modules.
- Tests must have **no warnings, no errors, and no suppressions** of any kind.
- Tests must be thorough.
- Don't Repeat Yourself.

## Phase 5 - Verify and Test

From **repository root**, run project's standard checks:

1. Build project:

```bash
yarn build
```

Also run package-specific builds required by workspace rules (e.g. `objectified-ui` per **CLAUDE.md**)

2. Run tests:

```bash
yarn test
```

Also run package-specific tests the issue touches, per READMEs.

3. Fix **any failures you introduced that block the ticket** before proceeding.
4. Repeat Phase 5 if either step fails.  If steps 1 and 2 are successful, continue to Phase 6.

## Phase 6 - Self Audit

1. Perform an audit of code that was generated.
2. Check code to see if improvements can be made before issuing a Pull Request.
3. Re-run `yarn build` and `yarn test` to ensure code quality if changes are made or improvements discovered.

## Phase 7 - Note Work

1. Mark ticket complete in **ROADMAP** and REMOVE ITS ENTRY FROM THE ISSUES TABLE matching the issue number.
2. Add one-line summary of work performed to **public/WHATS_NEW.md**.
3. Bump patch version of application in **objectified-ui/package.json** when change is made in **objectified-ui**.
4. Bump patch version of pyproject.toml in **objectified-rest** when change is made in that project.

## Phase 8 - Commit, Push, Pull Request

### Commit

```bash
git add -A
git commit -m "Fix #<number> - <concise description>"
```

### Push

```bash
git push origin ticket-<number>
```

### Open the PR

Use `gh` to create Pull Request from `ticket-<number>` into default branch:

```bash
gh pr create \
  --title "Fix #<number> - <concise title>" \
  --body "<body>" \
  --base main \
  --head ticket-<number>
```

#### PR body must include:

- What was done and why
- How to test
- Risk/notes
- Issue link: `Closes #<number>` (or `Fixes #<number>`)

### Assign Copilot as Reviewer

Request review from **Copilot** via `gh`.  Note assignment in a PR comment if needed.

### Mark Issue

Comment "Work completed as directed" on GitHub issue.

## Phase 9 - Explains How to Test

- Note how to test implementation of work.
- Include steps, with each important piece boldfaced (e.g. "**click button X**" or "**browse to Y**")
- Note example data to put into forms to test functionality.

## Phase 10 - Remain on Branch

Do not switch back to `main` after Pull Request is opened. Stay on `ticket-<number>`.

## Constraints

- **Scope:** Only change what issue requires; avoid unrelated refactors.
- **Secrets:** Never commit credentials or tokens.
- **Blocked:** If `GitHub MCP` is not authenticated, tests cannot be run, or the issue is inaccessible, say so clearly and stop after doing what is possible safely.
