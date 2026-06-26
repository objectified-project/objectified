# Objectified 07-2026 RC

We continue to improve the platform based on your feedback with improvements and new features!

---

## Bug Fixes

- CLI: Corrected Swagger 2.0 support in auto import mode
- CLI: Adds --force option to import so that warnings do not prevent publication
- Import: Corrected import for Swagger responses in paths to capture the schema properly for array items
- Import: Import speed greatly improved
- Import: Special cases with unicode characters are now properly handled
- Import: Better duplication checks - now compares project and version IDs before rejecting
- Import: Fixes publish flag when importing via CLI
- Import: Publish uses short note via description, title, or slug and version if not provided
- UI: Fixes Published Versions viewing of OpenAPI and Arazzo URLs
- UI: Fixes Published Versions list so versions starting with a "v" don't duplicate and show "vv"
- DB: Optimizations made to increase speed for import processing
- Import: Updates import service to include benchmarking output
- Import: Fixes linting problem in rare cases during import
- Import: Corrects base ref and $ref external dereferencing
- Import: Updating class creation step to increase speed using transactions and commits in groups

---

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: June 23, 2026*

