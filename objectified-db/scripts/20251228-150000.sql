-- OpenAPI Paths Schema Migration
-- Stores API path definitions for OpenAPI specification generation
-- Linked to versions (version_id) and references classes for request/response schemas
-- Supports full OpenAPI 3.1 path specification including operations, parameters,
-- request bodies, responses, security, and more

SET search_path TO odb, public;

-- Drop tables in reverse dependency order if they exist
DROP TABLE IF EXISTS odb.operation_tags CASCADE;
DROP TABLE IF EXISTS odb.operation_security CASCADE;
DROP TABLE IF EXISTS odb.operation_callbacks CASCADE;
DROP TABLE IF EXISTS odb.operation_responses CASCADE;
DROP TABLE IF EXISTS odb.operation_request_body_content CASCADE;
DROP TABLE IF EXISTS odb.operation_request_bodies CASCADE;
DROP TABLE IF EXISTS odb.operation_parameters CASCADE;
DROP TABLE IF EXISTS odb.path_operations CASCADE;
DROP TABLE IF EXISTS odb.api_paths CASCADE;
DROP TABLE IF EXISTS odb.api_tags CASCADE;
DROP TABLE IF EXISTS odb.security_schemes CASCADE;
DROP TABLE IF EXISTS odb.server_variables CASCADE;
DROP TABLE IF EXISTS odb.servers CASCADE;

-- ============================================================================
-- SERVERS TABLE
-- Defines server URLs for the API (can be at version level or path level)
-- ============================================================================
CREATE TABLE servers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE servers IS 'OpenAPI server objects defining base URLs for API endpoints';
COMMENT ON COLUMN servers.id IS 'Unique identifier for the server';
COMMENT ON COLUMN servers.version_id IS 'Reference to the version this server belongs to';
COMMENT ON COLUMN servers.url IS 'Server URL (may include variables like {protocol}://{host}:{port})';
COMMENT ON COLUMN servers.description IS 'Optional description of the server';
COMMENT ON COLUMN servers.sort_order IS 'Order in which servers appear in the specification';
COMMENT ON COLUMN servers.enabled IS 'Flag to enable/disable the server';
COMMENT ON COLUMN servers.deleted_at IS 'Soft delete timestamp';

CREATE INDEX idx_servers_version_id ON servers(version_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_servers_sort_order ON servers(sort_order);

-- ============================================================================
-- SERVER VARIABLES TABLE
-- Defines variables for server URL templates
-- ============================================================================
CREATE TABLE server_variables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    server_id UUID NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    default_value VARCHAR(1024) NOT NULL,
    description TEXT,
    enum_values JSONB,  -- Array of allowed values: ["value1", "value2"]
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(server_id, name)
);

COMMENT ON TABLE server_variables IS 'Variables for OpenAPI server URL templates';
COMMENT ON COLUMN server_variables.name IS 'Variable name (used in server URL as {name})';
COMMENT ON COLUMN server_variables.default_value IS 'Default value for the variable';
COMMENT ON COLUMN server_variables.enum_values IS 'JSON array of allowed values';

CREATE INDEX idx_server_variables_server_id ON server_variables(server_id);

-- ============================================================================
-- SECURITY SCHEMES TABLE
-- Defines security schemes available for the API
-- ============================================================================
CREATE TABLE security_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL CHECK (type IN ('apiKey', 'http', 'oauth2', 'openIdConnect', 'mutualTLS')),
    description TEXT,
    -- apiKey specific
    api_key_name VARCHAR(255),  -- Name of the header, query or cookie parameter
    api_key_in VARCHAR(20) CHECK (api_key_in IN ('query', 'header', 'cookie')),
    -- http specific
    http_scheme VARCHAR(50),  -- e.g., 'bearer', 'basic'
    http_bearer_format VARCHAR(100),  -- e.g., 'JWT'
    -- oauth2 specific
    oauth2_flows JSONB,  -- OAuth 2.0 flow configurations
    -- openIdConnect specific
    open_id_connect_url VARCHAR(2048),
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(version_id, name)
);

COMMENT ON TABLE security_schemes IS 'OpenAPI security scheme definitions';
COMMENT ON COLUMN security_schemes.type IS 'Security scheme type: apiKey, http, oauth2, openIdConnect, mutualTLS';
COMMENT ON COLUMN security_schemes.api_key_name IS 'Name of the API key header/query/cookie (for apiKey type)';
COMMENT ON COLUMN security_schemes.api_key_in IS 'Location of API key: query, header, or cookie';
COMMENT ON COLUMN security_schemes.http_scheme IS 'HTTP auth scheme name (e.g., bearer, basic)';
COMMENT ON COLUMN security_schemes.http_bearer_format IS 'Bearer token format hint (e.g., JWT)';
COMMENT ON COLUMN security_schemes.oauth2_flows IS 'OAuth 2.0 flow configurations as JSONB';
COMMENT ON COLUMN security_schemes.open_id_connect_url IS 'OpenID Connect discovery URL';

CREATE INDEX idx_security_schemes_version_id ON security_schemes(version_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_security_schemes_type ON security_schemes(type) WHERE deleted_at IS NULL;

-- ============================================================================
-- API TAGS TABLE
-- Defines tags for grouping and organizing API operations
-- Tags are version-specific and operations reference them by ID
-- ============================================================================
CREATE TABLE api_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    external_docs JSONB,  -- External documentation: { description, url }
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(version_id, name)
);

COMMENT ON TABLE api_tags IS 'OpenAPI tags for grouping and categorizing API operations';
COMMENT ON COLUMN api_tags.id IS 'Unique identifier for the tag';
COMMENT ON COLUMN api_tags.version_id IS 'Reference to the version this tag belongs to';
COMMENT ON COLUMN api_tags.name IS 'Tag name (unique within a version)';
COMMENT ON COLUMN api_tags.description IS 'Description of the tag for documentation';
COMMENT ON COLUMN api_tags.external_docs IS 'External documentation reference: { description, url }';
COMMENT ON COLUMN api_tags.sort_order IS 'Order in which tags appear in the specification';
COMMENT ON COLUMN api_tags.enabled IS 'Flag to enable/disable the tag';
COMMENT ON COLUMN api_tags.deleted_at IS 'Soft delete timestamp';

CREATE INDEX idx_api_tags_version_id ON api_tags(version_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_tags_name ON api_tags(name) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_tags_sort_order ON api_tags(sort_order);

-- ============================================================================
-- API PATHS TABLE
-- Main paths table defining URL patterns
-- ============================================================================
CREATE TABLE api_paths (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_id UUID NOT NULL REFERENCES versions(id) ON DELETE CASCADE,
    path VARCHAR(2048) NOT NULL,  -- The path pattern, e.g., /users/{userId}/orders
    summary VARCHAR(500),
    description TEXT,
    servers JSONB,  -- Path-level server overrides (array of server references or inline)
    parameters JSONB,  -- Path-level parameters shared by all operations
    sort_order INTEGER NOT NULL DEFAULT 0,
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(version_id, path)
);

COMMENT ON TABLE api_paths IS 'OpenAPI path items defining URL patterns for API endpoints';
COMMENT ON COLUMN api_paths.path IS 'URL path pattern (e.g., /users/{userId}/orders)';
COMMENT ON COLUMN api_paths.summary IS 'Short summary of what operations on this path do';
COMMENT ON COLUMN api_paths.description IS 'Detailed description of the path';
COMMENT ON COLUMN api_paths.servers IS 'Path-specific server overrides';
COMMENT ON COLUMN api_paths.parameters IS 'Parameters shared by all operations on this path';
COMMENT ON COLUMN api_paths.sort_order IS 'Order in which paths appear in the specification';

CREATE INDEX idx_api_paths_version_id ON api_paths(version_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_paths_path ON api_paths(path) WHERE deleted_at IS NULL;
CREATE INDEX idx_api_paths_sort_order ON api_paths(sort_order);

-- ============================================================================
-- PATH OPERATIONS TABLE
-- Defines HTTP operations (GET, POST, PUT, DELETE, etc.) for each path
-- ============================================================================
CREATE TABLE path_operations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    path_id UUID NOT NULL REFERENCES api_paths(id) ON DELETE CASCADE,
    method VARCHAR(10) NOT NULL CHECK (method IN ('get', 'post', 'put', 'delete', 'patch', 'options', 'head', 'trace')),
    operation_id VARCHAR(255),  -- Unique operation identifier
    summary VARCHAR(500),
    description TEXT,
    external_docs JSONB,  -- External documentation: { description, url }
    deprecated BOOLEAN NOT NULL DEFAULT false,
    deprecation_message TEXT,
    servers JSONB,  -- Operation-level server overrides
    enabled BOOLEAN NOT NULL DEFAULT true,
    deleted_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(path_id, method)
);

COMMENT ON TABLE path_operations IS 'HTTP operations (verbs) for API paths';
COMMENT ON COLUMN path_operations.method IS 'HTTP method: get, post, put, delete, patch, options, head, trace';
COMMENT ON COLUMN path_operations.operation_id IS 'Unique identifier for the operation (used for code generation)';
COMMENT ON COLUMN path_operations.summary IS 'Short summary of the operation';
COMMENT ON COLUMN path_operations.description IS 'Detailed description including markdown';
COMMENT ON COLUMN path_operations.external_docs IS 'External documentation reference';
COMMENT ON COLUMN path_operations.deprecated IS 'Flag indicating if operation is deprecated';
COMMENT ON COLUMN path_operations.deprecation_message IS 'Message explaining deprecation and alternatives';

CREATE INDEX idx_path_operations_path_id ON path_operations(path_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_path_operations_method ON path_operations(method) WHERE deleted_at IS NULL;
CREATE INDEX idx_path_operations_operation_id ON path_operations(operation_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_path_operations_deprecated ON path_operations(deprecated) WHERE deleted_at IS NULL AND deprecated = true;

-- ============================================================================
-- OPERATION TAGS TABLE
-- Junction table linking operations to tags
-- Tags are referenced by ID rather than by name for referential integrity
-- ============================================================================
CREATE TABLE operation_tags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES api_tags(id) ON DELETE CASCADE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id, tag_id)
);

COMMENT ON TABLE operation_tags IS 'Junction table linking API operations to tags by ID';
COMMENT ON COLUMN operation_tags.operation_id IS 'Reference to the path operation';
COMMENT ON COLUMN operation_tags.tag_id IS 'Reference to the API tag';
COMMENT ON COLUMN operation_tags.sort_order IS 'Order in which tags appear for this operation';

CREATE INDEX idx_operation_tags_operation_id ON operation_tags(operation_id);
CREATE INDEX idx_operation_tags_tag_id ON operation_tags(tag_id);

-- ============================================================================
-- OPERATION PARAMETERS TABLE
-- Defines parameters for operations (path, query, header, cookie)
-- ============================================================================
CREATE TABLE operation_parameters (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    location VARCHAR(20) NOT NULL CHECK (location IN ('path', 'query', 'header', 'cookie')),
    description TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    deprecated BOOLEAN NOT NULL DEFAULT false,
    allow_empty_value BOOLEAN NOT NULL DEFAULT false,
    style VARCHAR(50),  -- Serialization style: matrix, label, form, simple, spaceDelimited, pipeDelimited, deepObject
    explode BOOLEAN,
    allow_reserved BOOLEAN NOT NULL DEFAULT false,
    -- Schema reference (link to class) or inline schema
    schema_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    schema_inline JSONB,  -- Inline schema if not referencing a class
    example JSONB,
    examples JSONB,  -- Map of example objects
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id, name, location)
);

COMMENT ON TABLE operation_parameters IS 'Parameters for API operations';
COMMENT ON COLUMN operation_parameters.location IS 'Parameter location: path, query, header, cookie';
COMMENT ON COLUMN operation_parameters.style IS 'Serialization style for the parameter';
COMMENT ON COLUMN operation_parameters.schema_class_id IS 'Reference to a class for the parameter schema';
COMMENT ON COLUMN operation_parameters.schema_inline IS 'Inline JSON Schema if not referencing a class';
COMMENT ON COLUMN operation_parameters.examples IS 'Map of named examples';

CREATE INDEX idx_operation_parameters_operation_id ON operation_parameters(operation_id);
CREATE INDEX idx_operation_parameters_location ON operation_parameters(location);
CREATE INDEX idx_operation_parameters_schema_class_id ON operation_parameters(schema_class_id) WHERE schema_class_id IS NOT NULL;

-- ============================================================================
-- OPERATION REQUEST BODIES TABLE
-- Defines request body for operations
-- ============================================================================
CREATE TABLE operation_request_bodies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    description TEXT,
    required BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id)  -- One request body per operation
);

COMMENT ON TABLE operation_request_bodies IS 'Request body definitions for API operations';
COMMENT ON COLUMN operation_request_bodies.required IS 'Whether the request body is required';

CREATE INDEX idx_operation_request_bodies_operation_id ON operation_request_bodies(operation_id);

-- ============================================================================
-- OPERATION REQUEST BODY CONTENT TABLE
-- Defines content types and schemas for request bodies
-- ============================================================================
CREATE TABLE operation_request_body_content (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_body_id UUID NOT NULL REFERENCES operation_request_bodies(id) ON DELETE CASCADE,
    content_type VARCHAR(255) NOT NULL,  -- e.g., application/json, multipart/form-data
    -- Schema reference (link to class) or inline schema
    schema_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    schema_inline JSONB,  -- Inline schema if not referencing a class
    example JSONB,
    examples JSONB,  -- Map of example objects
    encoding JSONB,  -- Encoding configuration for multipart
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(request_body_id, content_type)
);

COMMENT ON TABLE operation_request_body_content IS 'Content type definitions for request bodies';
COMMENT ON COLUMN operation_request_body_content.content_type IS 'Media type (e.g., application/json)';
COMMENT ON COLUMN operation_request_body_content.schema_class_id IS 'Reference to a class for the body schema';
COMMENT ON COLUMN operation_request_body_content.schema_inline IS 'Inline JSON Schema if not referencing a class';
COMMENT ON COLUMN operation_request_body_content.encoding IS 'Encoding configuration for multipart content';

CREATE INDEX idx_request_body_content_request_body_id ON operation_request_body_content(request_body_id);
CREATE INDEX idx_request_body_content_schema_class_id ON operation_request_body_content(schema_class_id) WHERE schema_class_id IS NOT NULL;

-- ============================================================================
-- OPERATION RESPONSES TABLE
-- Defines responses for operations including status codes and content
-- ============================================================================
CREATE TABLE operation_responses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    status_code VARCHAR(10) NOT NULL,  -- HTTP status code or 'default', '1XX', '2XX', '3XX', '4XX', '5XX'
    description TEXT NOT NULL,
    -- Headers for the response
    headers JSONB,  -- Map of header definitions
    -- Content types and schemas
    content JSONB,  -- Map of content type to media type object: { "application/json": { schema: {...}, examples: {...} } }
    -- Schema reference (primary schema for common cases)
    schema_class_id UUID REFERENCES classes(id) ON DELETE SET NULL,
    links JSONB,  -- Map of link objects for hypermedia
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id, status_code)
);

COMMENT ON TABLE operation_responses IS 'Response definitions for API operations';
COMMENT ON COLUMN operation_responses.status_code IS 'HTTP status code (200, 404, etc.) or pattern (2XX, default)';
COMMENT ON COLUMN operation_responses.description IS 'Description of the response';
COMMENT ON COLUMN operation_responses.headers IS 'Response headers as JSONB map';
COMMENT ON COLUMN operation_responses.content IS 'Content type to media type mapping';
COMMENT ON COLUMN operation_responses.schema_class_id IS 'Primary schema class reference for the response body';
COMMENT ON COLUMN operation_responses.links IS 'Hypermedia link definitions';

CREATE INDEX idx_operation_responses_operation_id ON operation_responses(operation_id);
CREATE INDEX idx_operation_responses_status_code ON operation_responses(status_code);
CREATE INDEX idx_operation_responses_schema_class_id ON operation_responses(schema_class_id) WHERE schema_class_id IS NOT NULL;

-- ============================================================================
-- OPERATION SECURITY TABLE
-- Defines security requirements for operations
-- ============================================================================
CREATE TABLE operation_security (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    security_scheme_id UUID NOT NULL REFERENCES security_schemes(id) ON DELETE CASCADE,
    scopes JSONB,  -- Array of required scopes for OAuth2: ["read:users", "write:users"]
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id, security_scheme_id)
);

COMMENT ON TABLE operation_security IS 'Security requirements for API operations';
COMMENT ON COLUMN operation_security.scopes IS 'Required OAuth2 scopes as JSON array';

CREATE INDEX idx_operation_security_operation_id ON operation_security(operation_id);
CREATE INDEX idx_operation_security_security_scheme_id ON operation_security(security_scheme_id);

-- ============================================================================
-- OPERATION CALLBACKS TABLE
-- Defines callback operations for webhooks
-- ============================================================================
CREATE TABLE operation_callbacks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    operation_id UUID NOT NULL REFERENCES path_operations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,  -- Callback identifier
    expression VARCHAR(2048) NOT NULL,  -- Runtime expression for callback URL
    description TEXT,
    -- Callback operation definition stored as JSONB (contains path item object)
    callback_definition JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(operation_id, name)
);

COMMENT ON TABLE operation_callbacks IS 'Callback (webhook) definitions for async API operations';
COMMENT ON COLUMN operation_callbacks.expression IS 'Runtime expression for callback URL (e.g., {$request.body#/callbackUrl})';
COMMENT ON COLUMN operation_callbacks.callback_definition IS 'Path item object defining the callback operation';

CREATE INDEX idx_operation_callbacks_operation_id ON operation_callbacks(operation_id);

-- ============================================================================
-- UPDATE TRIGGERS
-- Automatically update the updated_at timestamp
-- ============================================================================

CREATE OR REPLACE FUNCTION update_api_paths_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_servers_updated_at
    BEFORE UPDATE ON servers
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_server_variables_updated_at
    BEFORE UPDATE ON server_variables
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_security_schemes_updated_at
    BEFORE UPDATE ON security_schemes
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_api_tags_updated_at
    BEFORE UPDATE ON api_tags
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_api_paths_updated_at
    BEFORE UPDATE ON api_paths
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_path_operations_updated_at
    BEFORE UPDATE ON path_operations
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_operation_parameters_updated_at
    BEFORE UPDATE ON operation_parameters
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_operation_request_bodies_updated_at
    BEFORE UPDATE ON operation_request_bodies
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_operation_request_body_content_updated_at
    BEFORE UPDATE ON operation_request_body_content
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_operation_responses_updated_at
    BEFORE UPDATE ON operation_responses
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

CREATE TRIGGER trigger_update_operation_callbacks_updated_at
    BEFORE UPDATE ON operation_callbacks
    FOR EACH ROW
    EXECUTE FUNCTION update_api_paths_updated_at();

-- ============================================================================
-- SUMMARY OF TABLES CREATED
-- ============================================================================
-- 1. servers - Base URLs for the API
-- 2. server_variables - Variables for server URL templates
-- 3. security_schemes - Security definitions (API key, OAuth2, etc.)
-- 4. api_tags - Tags for grouping and categorizing API operations (version-specific)
-- 5. api_paths - URL path patterns (/users, /users/{id}, etc.)
-- 6. path_operations - HTTP operations per path (GET, POST, PUT, DELETE, etc.)
-- 7. operation_tags - Junction table linking operations to tags by ID
-- 8. operation_parameters - Parameters for operations (path, query, header, cookie)
-- 9. operation_request_bodies - Request body container for operations
-- 10. operation_request_body_content - Content types for request bodies
-- 11. operation_responses - Response definitions with status codes
-- 12. operation_security - Security requirements per operation
-- 13. operation_callbacks - Webhook/callback definitions
-- ============================================================================

