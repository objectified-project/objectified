# Objectified 05-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## Git-like Functionality
- Added default-branch foundations for git-like workflows: branch rows now support a single project default (`isDefault`) with promotion support and first-commit auto-bootstrap of `main`.
- Added branch divergence REST support with merge-base, ahead/behind counts, commit samples, and strong ETag-based 304 responses for stable canvas sync indicators.
- Added a canvas branch picker: check out any named branch from the floating toolbar or git menu, with a current-branch chip, unsaved-layout guard, and refreshed tips after commit or merge.
- Added an ahead/behind default-branch chip on the canvas (feature branches only): live divergence from the REST API, commit samples in the tooltip, refresh on sidebar sync, and one-click deep link into Compare Version Schemas (merge base → branch tip).
- Added a prominent **Commit** control on the canvas toolbar (with unsaved-layout dot, ⌘/Ctrl+Enter from the flow surface, read-only guardrails) that opens the existing commit dialog locked to the active branch when named branches exist.
- Added **Sync from main** under the canvas git menu (feature branches): one-click merge preview with the default branch as source and the active branch as target, disabled with an up-to-date hint when divergence behind is zero; successful merge refreshes the branch list and divergence chip.

---

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: April 20, 2026*

