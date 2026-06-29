# Normalizer SPI (MFI-2.3)

> **Status:** SPI + reference implementation — `src/app/normalizer.py`,
> `src/app/openapi_normalizer.py`
> **Issue:** [#3740](https://github.com/objectified-project/objectified/issues/3740) ·
> **Epic:** MFI-EPIC-2 (#3717) · **Roadmap:** `docs/ROADMAP_MULTI_FORMAT_IMPORT.md`

The **Normalizer SPI** is the contract that turns a parsed source document of some
API description **format** (OpenAPI, gRPC/Protobuf, AsyncAPI, GraphQL, Avro, …)
into the one paradigm-agnostic [canonical model](./canonical_model.md)
(`CanonicalApi`, MFI-2.1). Each format epic implements one normalizer; everything
downstream — fingerprint, diff, lint, browse — is written once against the
canonical shape.

```
 parse (format-specific)        normalize (this SPI)            persist (MFI-2.2)
 raw bytes ──────────────▶ parsed tree ──────────────▶ CanonicalApi ─────▶ JSONB
                                          (Normalizer)
```

A normalizer is **pure**: it maps an already-parsed in-memory tree and returns a
`CanonicalApi`. Parsing, network fetches, and remote `$ref` resolution happen
*before* `normalize()` — the normalizer never does I/O.

## The contract

```python
class Normalizer(ABC):
    format: ClassVar[str]            # registry key, e.g. "openapi-3.1"
    paradigm: ClassVar[ApiParadigm]  # the canonical paradigm it emits

    @abstractmethod
    def normalize(self, source: Any, *, include_raw: bool = True) -> CanonicalApi: ...
```

A concrete normalizer must:

1. **Be deterministic and side-effect free** — same `source` → equal model, no I/O.
2. **Assign every entity a stable `key`** using the `Keys` helpers (below), so a
   diff lines two versions up by identity, not position.
3. **Preserve fidelity** — anything the canonical fields cannot hold goes in an
   entity's `extras` bag; the native source goes in `CanonicalApi.raw` (gated by
   `include_raw`).
4. **Return an order-normalized model** — finish with `normalize_ordering(api)` so
   the serialized output (and its fingerprint) is stable regardless of source
   ordering.

### Registration & lookup

Register a normalizer so the import pipeline can resolve it by detected format key
without importing every format module:

```python
class MyFormatNormalizer(Normalizer, register=True):   # auto-registers on definition
    format = "myformat-1"
    paradigm = ApiParadigm.RPC
    def normalize(self, source, *, include_raw=True): ...
```

```python
from app.normalizer import get_normalizer, available_formats
cls = get_normalizer("openapi-3.1")   # -> OpenApiNormalizer (or None)
available_formats()                    # -> ["openapi-3.0", "openapi-3.1", ...]
```

`register=True` on the class definition is equivalent to calling
`register_normalizer(cls)`. Re-registering the *same* class is a no-op (so module
re-import is safe); registering a *different* class under a taken key raises.

## Base utilities

These are the shared helpers the SPI provides so each format epic does not
re-implement them.

### 1. Stable-key assignment — `Keys`

Deterministic builders for each entity's `key`, matching the grammar in
[`canonical_model.md`](./canonical_model.md#stable-key-grammar):

| Helper | Example result |
|---|---|
| `Keys.operation_http(method, path)` | `GET /pets/{id}` |
| `Keys.parameter(op_key, location, name)` | `GET /pets/{id}#path.id` |
| `Keys.request_message(op_key)` | `GET /pets/{id}#request` |
| `Keys.response_message(op_key, status)` | `GET /pets/{id}#response.200` |
| `Keys.type(name[, namespace])` | `Pet` / `acme.Pet` |
| `Keys.field(type_key, name)` | `Pet.name` |
| `Keys.enum_value(type_key, value)` | `Status.ACTIVE` |
| `Keys.operation_rpc(service_key, method)` | `acme.PetService.GetPet` |
| `Keys.operation_graphql(root, field)` | `Query.user` |

### 2. Schema coercion — `coerce_constraints`, `SchemaCoercer`

Maps a JSON-Schema fragment into the canonical type model, **reusing the
JSON-Schema vocabulary** (OpenAPI 3.1 schemas *are* JSON Schema, and most formats'
constraint vocabularies map onto the same keywords) rather than inventing a
parallel one.

- `coerce_constraints(schema) -> Constraints | None` — extracts validation facets
  (`minLength`, `pattern`, `format`, `minimum`/`maximum`, …). Accepts
  `exclusiveMinimum`/`exclusiveMaximum` in both the JSON-Schema numeric form
  (draft 2020-12 / OpenAPI 3.1) and the OpenAPI-3.0 boolean form.
- `SchemaCoercer(components, ref_prefix)`:
  - `.type_ref(schema, required=...) -> TypeRef` — coerce a schema *at a use site*
    (a property/parameter/payload type) into a `TypeRef`, capturing list nesting
    and nullability exactly. `nullable` reflects *this level only*; a member is
    nullable when the schema marks it (`nullable: true`, or `"null"` in a 3.1
    `type` array) **or** when it is not `required`.
  - `.named_type(name, schema) -> Type` — coerce a *named* schema into a `Type`,
    inferring the kind: `oneOf`/`anyOf` → `UNION`; scalar + `enum` → `ENUM`;
    `object`/`properties` → `RECORD` (free-form `additionalProperties` → `MAP`);
    `array` → `ALIAS`; otherwise a constrained `SCALAR`.
  - `.named_types_from_components() -> list[Type]` — coerce every entry of the
    configured components map.

A `$ref` is never resolved inline; the referenced type name is recorded as the
`TypeRef.name` / member key so the canonical model stays a flat, self-referential
tree (which is what the persistence layer expects).

### 3. Ordering normalization — `normalize_ordering`

`normalize_ordering(api) -> CanonicalApi` returns a deep copy with the
**identity-keyed** collections (services, operations, parameters, messages,
message headers, channels, types, type fields) sorted by `key`, so two imports of
the same API produce byte-identical output regardless of source declaration order.
Collections whose order *is* semantically meaningful are left untouched:
`enum_values` (IDL ordinal), `union_members` (Avro resolution order),
`Server.variables`, and the opaque `raw`/`extras` bags.

## Reference implementation — `OpenApiNormalizer`

`app.openapi_normalizer.OpenApiNormalizer` is the worked example: parsed **OpenAPI
3.0 / 3.1** `dict` → `CanonicalApi` (paradigm `REST`).

| OpenAPI construct | Canonical mapping |
|---|---|
| `info.title` / `info.version` / `info.description` | `identity.name` / `version` / `description` |
| `servers[]` (+ `variables`) | `Server` (+ `ServerVariable`) |
| `components.schemas` | `types[]` (via `SchemaCoercer`) |
| `paths[path][method]` | `Operation` (`http_method`/`http_path`, `kind=REQUEST_RESPONSE`) |
| operation `tags[0]` (or `default`) | the owning `Service` |
| path- + operation-level `parameters` | `Parameter` (operation-level overrides path-level by name+location) |
| `requestBody` | `Message(role=REQUEST)` |
| `responses[code]` | `Message(role=RESPONSE)`, or `ERROR` for `4XX`/`5XX` |
| response `headers` | `Message.headers` (as fields) |
| `operationId` / `summary` | `Operation.extras` (+ `name`/`description`) |

A `$ref` body becomes a `Message.payload` `TypeRef`; an inline object body is kept
verbatim as `Message.payload_schema`. JSON media types are preferred when picking
the representative schema; all media types are recorded in `content_types`. Both
`openapi-3.0` and `openapi-3.1` are registered against this one implementation
(the coercer accepts both versions' nullability/exclusive-bound forms).

It self-registers, so:

```python
from app.openapi_normalizer import OpenApiNormalizer  # registers openapi-3.0/3.1
api = OpenApiNormalizer().normalize(parsed_openapi_dict)
```

## Implementing a new format normalizer

1. Subclass `Normalizer`, set `format` + `paradigm`, add `register=True`.
2. Parse the source upstream; in `normalize()` walk the parsed tree.
3. Key every entity with `Keys` (extend `Keys` if the paradigm needs a new shape).
4. Coerce schemas/types with `SchemaCoercer` + `coerce_constraints` where the
   format's type system overlaps JSON Schema; use `extras`/`raw` for the rest.
5. Return `normalize_ordering(api)`.
6. Add a fidelity test asserting the paradigm's load-bearing fields survive
   (MFI-2.4 is the cross-paradigm contract suite this feeds).

## Tests

- `tests/test_normalizer.py` — the SPI: registry, key grammar, constraint/type
  coercion, ordering normalization.
- `tests/test_openapi_normalizer.py` — the reference normalizer end-to-end on a
  representative OpenAPI 3.1 document, plus 3.0-specific forms, determinism, the
  lossless JSONB round-trip, and error paths.
