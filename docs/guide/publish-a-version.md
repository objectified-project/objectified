# How do I… publish a version?

Publishing freezes a version and makes it available to **browse**, **export**, and **MCP** consumers.
Publishing enforces server-side **publish gates** — it will refuse a version that does not meet them.

**Publish gates:**

- the reconstructed document is valid OpenAPI,
- every class is documented (has a description),
- there are no un-acknowledged breaking changes.

You choose a **visibility** when publishing: `public` (anyone can browse it) or `private` (only
in-scope API keys can reach it).

---

## In the UI

1. Open **Versions** at `/ade/dashboard/versions` and select the version.
2. Choose **Publish**, pick **public** or **private**, and add a revision note.
3. If a gate fails, the UI reports which one — fix it (usually a missing description or an
   unacknowledged breaking change) and publish again.
4. Published versions are listed under `/ade/dashboard/published`.

## With the REST API

```http
POST /v1/versions/{tenant_slug}/{project_id}/{version_record_id}/publish
X-API-Key: <your-api-key>

{ "visibility": "public", "notes": "First public cut." }
```

Returns the version with `published = true`. To reverse it:

```http
POST /v1/versions/{tenant_slug}/{project_id}/{version_record_id}/unpublish
```

## Tip: lint before you publish

Run [lint-and-quality.md](lint-and-quality.md) first — clearing its findings clears most publish-gate
failures before you hit them.

## Verify

- **Browse:** `GET /v1/browse/tenants/{tenant}/projects/{project}/versions` lists the published
  version — see [browse-published-specs.md](browse-published-specs.md).
- **Export:** the version's OpenAPI is now reconstructable — see [export-a-spec.md](export-a-spec.md).
- **MCP:** a published *public* spec shows up via `spec.list` — see [mcp-quickstart.md](mcp-quickstart.md).

## Related

- [cut-a-version.md](cut-a-version.md) — the version you publish
- [browse-published-specs.md](browse-published-specs.md) — where it lands
