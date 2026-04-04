# Objectified: Code Generation - Feature Roadmap

> Multi-language code generation engine that transforms Objectified schemas and paths into production-ready model definitions, server stubs, client SDKs, CRUD operations, and mock data — covering the full spectrum from schema-to-types through path-to-server-framework.
>
> **Revenue Model**: TypeScript, Python, and GraphQL generation in all tiers; Java, C#, Go, Rust, Scala, ORM models, and OpenAPI client SDK generation gated at Pro; server stub generation, CI/CD-integrated code export, and custom template engine are Enterprise-only
>
> **Tech Stack**: NextJS App Router, TypeScript code generation engine, Handlebars/EJS templates, OpenAPI Generator (Java wrapper), Faker.js for mock data, PostgreSQL (generation job history), OpenAPI 3.1

---

## MVP Definition

- TypeScript interface and type generation from schemas
- Python Pydantic model generation with full OpenAPI constraint mapping
- Python Dataclass generation (standard library, frozen option, post-init validation)
- Preview generated code before download
- Download as single file or project structure
- Code generation settings per language: naming conventions, nullable handling, documentation comments
- Markdown documentation export (MSON format)

---

## Epic 1: Schema-to-Code Generation

### Summary Table

| #   | Title                                     | Description                                                                       | Labels                                               | MVP | Parallel |
|-----|-------------------------------------------|-----------------------------------------------------------------------------------|------------------------------------------------------|-----|----------|
| 1.1 | TypeScript Interfaces & Types             | Generate TypeScript interfaces with full composition support and JSDoc comments   | `enhancement`, `mvp`, `code-generation`, `rest`     | Yes | No       |
| 1.2 | TypeScript Extended (Zod)                 | Generate Zod validators alongside TypeScript types for runtime validation         | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.3 | Python Pydantic Models                    | Pydantic v2 models with field validators, constraints, and root validators        | `enhancement`, `mvp`, `code-generation`             | Yes | Yes      |
| 1.4 | Python Dataclasses                        | Standard library dataclasses with type hints, frozen option, post-init hooks      | `enhancement`, `mvp`, `code-generation`             | Yes | Yes      |
| 1.5 | Python SQLAlchemy Models                  | SQLAlchemy 2.0+ declarative models with relationships, indexes, Alembic support   | `enhancement`, `code-generation`                    | No  | No       |
| 1.6 | Python Hybrid (Pydantic + SQLAlchemy)     | Combined models: SQLAlchemy for persistence, Pydantic for API serialization       | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.7 | Java POJOs, Records & JPA Entities        | Generate Java POJOs, Records (Java 16+), and JPA entity classes                  | `enhancement`, `code-generation`                    | No  | No       |
| 1.8 | C# Classes, Records & EF Core Models      | C# POCO classes, C# Records, and Entity Framework Core model generation           | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.9 | Go Structs with JSON Tags                 | Go struct generation with JSON, YAML, and db struct tags                          | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.10 | Rust Structs with Serde                  | Rust struct generation with Serde derive macros and optional async support        | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.11 | Scala Case Classes                       | Scala case class generation with Play JSON format derivation                      | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.12 | Markdown (MSON Format)                   | Export schemas as human-readable Markdown documentation tables                    | `enhancement`, `mvp`, `code-generation`             | Yes | Yes      |
| 1.13 | Code Generation Settings per Language    | Per-language config: naming convention, nullable handling, doc comment style      | `enhancement`, `mvp`, `code-generation`             | Yes | No       |
| 1.14 | Preview Before Download                  | Side-by-side preview of generated code before committing to download             | `enhancement`, `mvp`, `code-generation`             | Yes | No       |
| 1.15 | Download as Project Structure            | Download all generated files in a ZIP with proper directory layout and config     | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.16 | Generate Unit Tests with Models          | Generate skeleton unit tests for each model class                                 | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.17 | Export to Liquibase Changesets           | Generate Liquibase XML/YAML changeset files from schema class definitions         | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.18 | Export to Excel                          | Export schema as Excel workbook with one sheet per class                          | `enhancement`, `code-generation`                    | No  | Yes      |
| 1.19 | Export to PDF                            | Render schema documentation as a formatted PDF report                             | `enhancement`, `code-generation`                    | No  | Yes      |

### Detailed Issue Descriptions

#### 1.1 — TypeScript Interfaces & Types

Generate TypeScript interface and type definitions from Objectified schema classes. Support full OpenAPI composition (`allOf` → interface extension, `oneOf` → union type, `anyOf` → intersection). Include JSDoc comments sourced from class/property descriptions. Apply configurable naming conventions.

**Output example:**
```typescript
/**
 * Represents a user account in the system.
 * @since 1.0.0
 */
export interface User {
  /** Unique user identifier (UUID v4) */
  id: string;
  /** Display name shown in the UI */
  displayName: string;
  /** Primary email address (RFC 5322) */
  email: string;
  /** Account creation timestamp */
  createdAt: string; // ISO 8601
  /** Optional profile bio (max 500 chars) */
  bio?: string;
}

export type CreateUserRequest = Omit<User, 'id' | 'createdAt'>;
export type UpdateUserRequest = Partial<CreateUserRequest>;
```

**OpenAPI Endpoints:**
```
POST /api/v1/generate/typescript
  Body: { project_id, version_id, class_ids?: UUID[], options: GenerationOptions }
  → 200: GeneratedFile { content: string, filename: string }
  → 202: GenerationJob { job_id }  (for large schemas)
```

**Acceptance Criteria:**
- `allOf` compositions generate TypeScript interface extension (`extends`)
- `oneOf` generates TypeScript union types (`A | B | C`)
- Optional properties (not in `required` array) use `?:` syntax
- Generated code passes `tsc --strict --noEmit` (validated in CI)
- `#223` addressed by this issue

**Tech Stack:** TypeScript AST builder, OpenAPI 3.1 composition mapping

Part of Epic: Schema-to-Code Generation

---

#### 1.3 — Python Pydantic Models

Generate Pydantic v2 `BaseModel` classes with field validators derived from OpenAPI constraints (`minLength`, `maxLength`, `pattern`, `minimum`, `maximum`, `enum`). Use `Field(...)` for required fields and `Field(None)` for optional. Include `model_config = ConfigDict(...)` for additional settings.

**Output example:**
```python
from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional
import re

class User(BaseModel):
    """Represents a user account in the system."""
    model_config = ConfigDict(populate_by_name=True)

    id: str = Field(..., description="Unique user identifier (UUID v4)")
    display_name: str = Field(..., min_length=1, max_length=100, alias="displayName")
    email: str = Field(..., description="Primary email address (RFC 5322)")
    created_at: str = Field(..., alias="createdAt")
    bio: Optional[str] = Field(None, max_length=500)

    @field_validator('email')
    @classmethod
    def validate_email(cls, v: str) -> str:
        if not re.match(r'^[\w\.-]+@[\w\.-]+\.\w+$', v):
            raise ValueError('Invalid email format')
        return v
```

**Acceptance Criteria:**
- Generated code passes `mypy --strict` (validated in CI)
- `enum` properties generate Python `Enum` classes
- `required` array correctly maps to required vs optional fields
- Camel-case → snake_case conversion via `alias` and `populate_by_name=True`
- `#224` addressed by this issue

Part of Epic: Schema-to-Code Generation

---

#### 1.5 — Python SQLAlchemy Models

Generate SQLAlchemy 2.0+ declarative models using the new `Mapped` and `mapped_column` annotation style. Derive table names via snake_case pluralization of class names. Map OpenAPI formats to column types: `uuid` → `UUID`, `date-time` → `DateTime(timezone=True)`, etc. Generate relationship mappings from schema `$ref` links.

**Output example:**
```python
from sqlalchemy import String, ForeignKey, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
import uuid
from datetime import datetime

class Base(DeclarativeBase):
    pass

class User(Base):
    __tablename__ = 'users'

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True,
                                           default=uuid.uuid4)
    display_name: Mapped[str] = mapped_column(String(100), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True),
                                                   server_default='now()')
    bio: Mapped[str | None] = mapped_column(String(500))

    posts: Mapped[list["Post"]] = relationship(back_populates="author")
```

**Acceptance Criteria:**
- Relationship mappings derived from `$ref` in schema definitions
- `unique: true` properties generate `unique=True` column constraint
- Alembic migration skeleton generated alongside model file
- Generated code imports are minimal (no unused imports)

Part of Epic: Schema-to-Code Generation

---

#### 1.13 — Code Generation Settings per Language

Provide a per-language configuration panel (`Settings → Code Generation`) where users set: naming convention (camelCase, snake_case, PascalCase for properties), nullable handling (Optional[T] vs T | None), documentation comment style (JSDoc, Python docstring, Java Javadoc), and whether to include validation annotations.

```
Code Generation Settings
┌──────────────────────────────────────────────────────┐
│  TypeScript                                          │
│  Property naming: [camelCase ▼]                      │
│  Null handling: [optional (?) ▼]                     │
│  Comments: [JSDoc ▼]                                 │
│  Include Zod validators: [○ OFF]                     │
├──────────────────────────────────────────────────────┤
│  Python                                              │
│  Model type: [Pydantic v2 ▼]                         │
│  Property naming: [snake_case ▼]                     │
│  Include mypy stubs: [✓ ON]                          │
│  Generate tests: [○ OFF]                             │
└──────────────────────────────────────────────────────┘
```

**Acceptance Criteria:**
- Settings persisted per user per language in `user_codegen_settings` JSONB column
- Settings applied on next generation without requiring page reload
- "Reset to defaults" button available per language
- `#509` addressed by this issue

Part of Epic: Schema-to-Code Generation

---

## Epic 2: OpenAPI Client SDK Generation

### Summary Table

| #   | Title                                     | Description                                                                       | Labels                                          | MVP | Parallel |
|-----|-------------------------------------------|-----------------------------------------------------------------------------------|-------------------------------------------------|-----|----------|
| 2.1 | OpenAPI Generator Integration             | Wrap the OpenAPI Generator CLI to support all major language targets              | `enhancement`, `code-generation`               | No  | No       |
| 2.2 | One-Click Client SDK Download             | Select language, click generate, download as NPM/PyPI/Maven-ready package         | `enhancement`, `code-generation`, `rest`       | No  | No       |
| 2.3 | NPM Package Publishing Integration        | Push generated TypeScript client directly to the tenant's NPM registry            | `enhancement`, `code-generation`               | No  | Yes      |
| 2.4 | PyPI Publishing Integration               | Push generated Python client to PyPI or a private package index                  | `enhancement`, `code-generation`               | No  | Yes      |
| 2.5 | Maven / Gradle Publishing Integration     | Push generated Java client to Maven Central or a private Nexus/Artifactory        | `enhancement`, `code-generation`               | No  | Yes      |

---

## Epic 3: Path-to-Code Generation (Server Stubs & CRUD)

### Summary Table

| #   | Title                                     | Description                                                                       | Labels                                          | MVP | Parallel |
|-----|-------------------------------------------|-----------------------------------------------------------------------------------|-------------------------------------------------|-----|----------|
| 3.1 | CRUD Operation Auto-Generation            | One-click: select a schema class, generate all 5 CRUD + List operations as paths | `enhancement`, `code-generation`, `rest`       | No  | No       |
| 3.2 | CRUD URL Pattern Customization            | Configure ID parameter name, ID type, URL prefix, singular/plural, nested paths  | `enhancement`, `code-generation`               | No  | Yes      |
| 3.3 | CRUD Operation Selection                  | Enable/disable individual CRUD operations (read-only, write-only, custom combos) | `enhancement`, `code-generation`               | No  | Yes      |
| 3.4 | Response Wrapper Customization            | Choose response envelope format, pagination style, error schema structure         | `enhancement`, `code-generation`               | No  | Yes      |
| 3.5 | Bulk Operations Generation                | Generate bulk create, update, and delete endpoints alongside standard CRUD        | `enhancement`, `code-generation`               | No  | Yes      |
| 3.6 | Express.js Server Stub                    | Generate Express.js route handlers with TODO stubs, mock data, and OpenAPI middleware | `enhancement`, `code-generation`           | No  | No       |
| 3.7 | FastAPI Server Stub                       | Generate FastAPI endpoint functions with Pydantic models and HTTPException stubs  | `enhancement`, `code-generation`               | No  | Yes      |
| 3.8 | Spring Boot Server Stub                   | Generate Spring Boot controllers with @RestController, @RequestMapping, and DTO stubs | `enhancement`, `code-generation`           | No  | Yes      |
| 3.9 | NestJS Server Stub                        | Generate NestJS controller, service, module, and DTO files                        | `enhancement`, `code-generation`               | No  | Yes      |
| 3.10 | Go / Gin Server Stub                     | Generate Go handler functions with Gin router registration and struct binding    | `enhancement`, `code-generation`               | No  | Yes      |
| 3.11 | Rust / Axum Server Stub                  | Generate Axum router with handler functions and serde-based request/response types| `enhancement`, `code-generation`               | No  | Yes      |

### Detailed Issue Descriptions

#### 3.1 — CRUD Operation Auto-Generation

Implement "Generate CRUD" as a canvas right-click action on any class. Automatically generates 6 path operations following RESTful conventions and adds them to the project's Paths section.

| Operation | Method | Path | Response |
|-----------|--------|------|----------|
| List | `GET` | `/resources` | `200: ResourceList` with pagination |
| Create | `POST` | `/resources` | `201: Resource`, `400: ValidationError` |
| Get One | `GET` | `/resources/{id}` | `200: Resource`, `404: NotFound` |
| Update | `PUT` | `/resources/{id}` | `200: Resource`, `404`, `400` |
| Partial Update | `PATCH` | `/resources/{id}` | `200: Resource`, `404`, `400` |
| Delete | `DELETE` | `/resources/{id}` | `204: NoContent`, `404` |

**Acceptance Criteria:**
- Generated paths use the class name (pluralized, kebab-case) as the URL segment
- Request/response schemas reference the source class (not duplicate definitions)
- List operation includes `limit`, `offset`, and cursor pagination parameters
- All generated operations tagged with the class name for grouping in Swagger UI
- Conflict detection: warns if paths with the same pattern already exist

Part of Epic: Path-to-Code Generation

---

#### 3.6 — Express.js Server Stub

Generate complete Express.js route files for each path operation. Include TODO comments for database implementation, mock data pre-populated from schema examples, OpenAPI validation middleware (express-openapi-validator), and standard error handling.

**Output example:**
```javascript
// GET /users/:id — Get a single user by ID
router.get('/users/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    // TODO: Replace with actual database query
    const user = mockData.users.find(u => u.id === id);
    if (!user) {
      return res.status(404).json({
        error: 'not_found',
        message: `User with id '${id}' not found`,
      });
    }
    res.json(user);
  } catch (err) {
    next(err);
  }
});
```

**Acceptance Criteria:**
- Generated file includes all operations for the path grouped in one router file
- Mock data file auto-generated from schema examples (using Faker.js for missing examples)
- OpenAPI validation middleware wired by default
- README.md generated with setup instructions and `npm install` command

Part of Epic: Path-to-Code Generation

---

## Epic 4: Mock Data Generation

### Summary Table

| #   | Title                                     | Description                                                                       | Labels                                     | MVP | Parallel |
|-----|-------------------------------------------|----------------------------------------------------------------------------------|--------------------------------------------|-----|----------|
| 4.1 | Mock Data from Schema Examples            | Use schema-defined examples as the basis for static mock responses               | `enhancement`, `code-generation`          | No  | Yes      |
| 4.2 | Dynamic Random Data Generation            | Faker.js-powered random data respecting constraints (min/max, pattern, enum)     | `enhancement`, `code-generation`          | No  | Yes      |
| 4.3 | Related Data Consistency (FK Simulation)  | Generate consistent IDs across related entities (parent.id matches child.parentId)| `enhancement`, `code-generation`         | No  | Yes      |
| 4.4 | Bulk Mock Dataset Generation              | Generate a configurable number of records (1–1000) per class                     | `enhancement`, `code-generation`          | No  | Yes      |
| 4.5 | Export Mock Data as JSON / CSV / SQL      | Download generated mock data in JSON, CSV, or as SQL INSERT statements            | `enhancement`, `code-generation`, `rest`  | No  | Yes      |
| 4.6 | Seed Database with Mock Data              | Execute INSERT statements against a configured dev database connection            | `enhancement`, `code-generation`          | No  | No       |
