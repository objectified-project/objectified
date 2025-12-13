# Arazzo Handlebars Templates

This directory contains Handlebars templates for generating Arazzo v1.0.1 workflow specifications.

## Templates

### arazzo-spec.hbs
Main template for the complete Arazzo specification document.

**Template Data:**
- `arazzo` (string): Arazzo specification version (e.g., "1.0.1")
- `info` (object): Information about the API workflows
  - `title` (string): Title of the workflow collection
  - `version` (string): Version of the workflow specification
  - `description` (string): Description of the workflows
  - `summary` (string, optional): Summary of the workflows
  - `contact` (object, optional): Contact information
  - `license` (object, optional): License information
- `sourceDescriptions` (array): Array of source description objects
- `workflows` (array): Array of workflow objects
- `xMetadata` (object, optional): Custom metadata extension

**Example:**
```javascript
{
  arazzo: "1.0.1",
  info: {
    title: "My API Workflows",
    version: "1.0.0",
    description: "Generated workflow specifications"
  },
  sourceDescriptions: [...],
  workflows: [...],
  xMetadata: {...}
}
```

### workflow.hbs
Template for individual workflow objects.

**Template Data:**
- `workflowId` (string): Unique identifier for the workflow
- `summary` (string): Brief summary of the workflow
- `description` (string): Detailed description of the workflow
- `steps` (array): Array of step objects

**Example:**
```javascript
{
  workflowId: "userWorkflow",
  summary: "User CRUD Workflow",
  description: "Operations for User",
  steps: [...]
}
```

### step.hbs
Template for individual workflow step objects.

**Template Data:**
- `stepId` (string): Unique identifier for the step
- `description` (string): Description of what the step does
- `operationId` (string): Reference to the OpenAPI operation
- `parameters` (array, optional): Array of parameter objects
- `requestBody` (object, optional): Request body specification
- `successCriteria` (array): Array of success criteria objects
- `outputs` (object, optional): Output values from the step
- `dependsOn` (array, optional): Array of step IDs this step depends on

**Example:**
```javascript
{
  stepId: "createUser",
  description: "Create a new User",
  operationId: "createUser",
  parameters: [],
  requestBody: {
    contentType: "application/json",
    payload: { $ref: "#/components/schemas/User" }
  },
  successCriteria: [
    { condition: "$statusCode == 201", type: "simple" }
  ],
  outputs: {
    userId: "$response.body.id"
  }
}
```

### source-description.hbs
Template for source description objects that reference external API specifications.

**Template Data:**
- `name` (string): Name identifier for the source
- `type` (string): Type of source (e.g., "openapi")
- `url` (string): URL to the source specification
- `description` (string, optional): Description of the source

**Example:**
```javascript
{
  name: "openapi-source",
  type: "openapi",
  url: "./openapi.json",
  description: "OpenAPI specification containing schema definitions"
}
```

## Usage

The templates are used by the `generateArazzoSpec()` function in `arazzo.ts`:

```typescript
import { renderTemplate } from './template-loader';

const arazzoSpec = await renderTemplate('arazzo/arazzo-spec.hbs', {
  arazzo: '1.0.1',
  info: {...},
  sourceDescriptions: [...],
  workflows: [...],
  xMetadata: {...}
});
```

## Handlebars Helpers

The following custom Handlebars helpers are available (from `template-loader.ts`):

- `{{json object}}` - Converts an object to formatted JSON (2-space indent)
- `{{jsonInline object}}` - Converts an object to inline JSON
- `{{#if (hasValue value)}}` - Checks if value exists and is not empty
- `{{#if (hasKeys object)}}` - Checks if object has keys

## Arazzo Specification Reference

For more information about the Arazzo specification, see:
- [Arazzo Specification v1.0.1](https://spec.openapis.org/arazzo/latest.html)
- [Arazzo GitHub Repository](https://github.com/OAI/Arazzo-Specification)

