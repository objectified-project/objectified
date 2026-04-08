# Objectified 04-2026

We continue to improve the platform based on your feedback with improvements and new features!

---

## UI:
- **Import from URL:** Source tabs switch between File, URL, Clipboard, Git, and SwaggerHub; URL step matches the import spec (auth, URL options including cache, **Test URL** and **Next** in the dialog footer)
- **Git import:** Load a GitHub repository by URL or `owner/repo`, pick a **branch** or **tag**, optionally type a **spec path** and open it, or browse the tree — directory listing uses the selected ref (same behavior when choosing a repo from the list)
- **OpenAPI import:** Import step shows the **Import Execution** layout — progress with schema index and ETA, per-schema live checklist (success / warning / in progress / pending), expandable import log, and technical summary in a collapsible section
- **What's New** dialog is centered on the viewport again (overlay renders outside the header so it is not offset downward)
- **Import classes:** duplicate-schema rows in the conflict report include **Schema diff** — side-by-side property diff (new / modified / removed), summary counts, and resolution choices (merge, replace, keep current, rename) before you apply
- **OpenAPI import:** one shared rule for “direct” schema properties — specs that mix top-level `properties` with inline `allOf` fragments now pick up both (aligned with the unified class importer)


## Projects:
- Added ability to start a new project from a template

## Groups:
- Studio **Groups** tab: each group row can expand or collapse; collapsed rows show the group name and node count, expanded rows list the classes in that group (click a class to focus it on the canvas when click-to-focus is enabled)
- Canvas group frames: set a custom container color with the palette popover (hex picker and `#RRGGBB` field); colors saved from the database display correctly
- Layout panel: group classes that share the same project tag name into separate canvas frames (multi-tagged classes are placed in one group via a clear A–Z rule)
- Canvas groups can be assigned project tags from the group style settings (saved with the group for future search and filtering)
- Fixed group tag picker and chips so tag names and colors show correctly (project tags use `name`/`color` from the database)

## Account:
- Removed verbose NextAuth debug logging from server and client auth flows (credentials, OAuth linking, JWT/session callbacks)
- Profile shows your last successful login date and time (stored when you sign in with email/password or OAuth)

View our YouTube channel [here](https://www.youtube.com/@objectifieddev) for detailed tutorials and walkthroughs!

---

## Feedback

We'd love to hear your thoughts! Your feedback helps us make Objectified better.

---

**Thank you for using Objectified!**

*Last updated: April 7, 2026*

