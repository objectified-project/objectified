/**
 * Arazzo Specification Generator Utilities
 *
 * Generates Arazzo v1.0.1 workflow specifications from class definitions.
 * Arazzo is a specification for describing sequences of API calls and their dependencies.
 */

/**
 * Generates a complete Arazzo v1.0.1 specification from class definitions
 * @param classes - Array of class data objects with properties
 * @param options - Optional metadata for the spec
 * @returns Arazzo document as a JSON string
 */
export function generateArazzoSpec(
  classes: any[],
  options?: {
    projectName?: string;
    version?: string;
    description?: string;
  }
): string {
  // Generate workflows based on CRUD operations for each class
  const workflows = classes.map((cls) => {
    const className = cls.name;
    const classDescription = cls.description || `Operations for ${className}`;

    // Build steps for CRUD operations
    const steps = [
      {
        stepId: `create${className}`,
        description: `Create a new ${className}`,
        operationId: `create${className}`,
        parameters: [],
        requestBody: {
          contentType: 'application/json',
          payload: {
            $ref: `#/components/schemas/${className}`
          }
        },
        successCriteria: [
          {
            condition: '$statusCode == 201',
            type: 'simple'
          }
        ],
        outputs: {
          [`${className.toLowerCase()}Id`]: '$response.body.id'
        }
      },
      {
        stepId: `get${className}`,
        description: `Retrieve a ${className} by ID`,
        operationId: `get${className}ById`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            value: `$steps.create${className}.outputs.${className.toLowerCase()}Id`
          }
        ],
        successCriteria: [
          {
            condition: '$statusCode == 200',
            type: 'simple'
          }
        ],
        dependsOn: [`create${className}`]
      },
      {
        stepId: `update${className}`,
        description: `Update an existing ${className}`,
        operationId: `update${className}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            value: `$steps.create${className}.outputs.${className.toLowerCase()}Id`
          }
        ],
        requestBody: {
          contentType: 'application/json',
          payload: {
            $ref: `#/components/schemas/${className}`
          }
        },
        successCriteria: [
          {
            condition: '$statusCode == 200',
            type: 'simple'
          }
        ],
        dependsOn: [`create${className}`]
      },
      {
        stepId: `delete${className}`,
        description: `Delete a ${className}`,
        operationId: `delete${className}`,
        parameters: [
          {
            name: 'id',
            in: 'path',
            value: `$steps.create${className}.outputs.${className.toLowerCase()}Id`
          }
        ],
        successCriteria: [
          {
            condition: '$statusCode == 204',
            type: 'simple'
          }
        ],
        dependsOn: [`update${className}`]
      }
    ];

    return {
      workflowId: `${className.toLowerCase()}Workflow`,
      summary: `${className} CRUD Workflow`,
      description: classDescription,
      steps
    };
  });

  // Build the complete Arazzo document
  const arazzoDoc = {
    arazzo: '1.0.1',
    info: {
      title: options?.projectName ? `${options.projectName} Workflows` : 'API Workflows',
      version: options?.version || '1.0.0',
      description: options?.description || 'Generated Arazzo 1.0.1 workflow specification from Objectified Studio'
    },
    sourceDescriptions: [
      {
        name: 'openapi-source',
        type: 'openapi',
        url: './openapi.json',
        description: 'OpenAPI specification containing schema definitions'
      }
    ],
    workflows
  };

  return JSON.stringify(arazzoDoc, null, 2);
}

