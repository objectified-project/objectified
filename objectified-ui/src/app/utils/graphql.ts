/**
 * GraphQL SDL Generator
 * Generates GraphQL Schema Definition Language from class definitions
 */

interface ClassWithProperties {
  id: string;
  name: string;
  description?: string;
  properties: any[];
  schema?: any;
  tags?: any[];
}

interface GraphQLOptions {
  projectName?: string;
  version?: string;
  description?: string;
}

/**
 * Map JSON schema type to GraphQL type
 */
function mapTypeToGraphQL(property: any): string {
  const type = property.type || 'string';
  const format = property.format;

  if (type === 'array') {
    const itemType = property.items?.type || 'String';
    const graphQLItemType = itemType.charAt(0).toUpperCase() + itemType.slice(1);
    return `[${graphQLItemType}!]`;
  }

  switch (type) {
    case 'integer':
      return 'Int';
    case 'number':
      return 'Float';
    case 'boolean':
      return 'Boolean';
    case 'string':
      if (format === 'date-time' || format === 'date') return 'String'; // Could use DateTime scalar
      if (format === 'uuid') return 'ID';
      return 'String';
    case 'object':
      // For nested objects, use the property name as type reference
      return property.title || 'JSON'; // Default to JSON scalar for untyped objects
    default:
      return 'String';
  }
}

/**
 * Generate GraphQL SDL from classes
 */
export function generateGraphQLSchema(
  classes: ClassWithProperties[],
  options: GraphQLOptions = {}
): string {
  let sdl = '# GraphQL Schema Definition Language (SDL)\n';
  sdl += `# Generated from ${options.projectName || 'Project'}\n`;
  if (options.version) {
    sdl += `# Version: ${options.version}\n`;
  }
  if (options.description) {
    sdl += `# ${options.description}\n`;
  }
  sdl += `# Generated at ${new Date().toISOString()}\n\n`;

  // Process each class
  for (const cls of classes) {
    const className = cls.name;
    const description = cls.description;
    const properties = Array.isArray(cls.properties) ? cls.properties : [];

    // Add description as comment if available
    if (description) {
      sdl += `"""\n${description}\n"""\n`;
    }

    sdl += `type ${className} {\n`;

    // Add ID field by default
    sdl += `  id: ID!\n`;

    // Process properties
    for (const prop of properties) {
      const propName = prop.name;
      const propDescription = prop.description;
      const isRequired = prop.required || false;
      const graphQLType = mapTypeToGraphQL(prop);
      const nullable = isRequired ? '!' : '';

      // Add property description as comment
      if (propDescription) {
        sdl += `  """\n  ${propDescription}\n  """\n`;
      }

      sdl += `  ${propName}: ${graphQLType}${nullable}\n`;
    }

    sdl += `}\n\n`;
  }

  // Add Query type
  if (classes.length > 0) {
    sdl += `type Query {\n`;
    for (const cls of classes) {
      const className = cls.name;
      const lowerClassName = className.charAt(0).toLowerCase() + className.slice(1);

      sdl += `  ${lowerClassName}(id: ID!): ${className}\n`;
      sdl += `  ${lowerClassName}s: [${className}!]!\n`;
    }
    sdl += `}\n\n`;

    // Add Mutation type
    sdl += `type Mutation {\n`;
    for (const cls of classes) {
      const className = cls.name;
      const lowerClassName = className.charAt(0).toLowerCase() + className.slice(1);

      sdl += `  create${className}(input: Create${className}Input!): ${className}!\n`;
      sdl += `  update${className}(id: ID!, input: Update${className}Input!): ${className}!\n`;
      sdl += `  delete${className}(id: ID!): Boolean!\n`;
    }
    sdl += `}\n\n`;

    // Add Input types for mutations
    for (const cls of classes) {
      const className = cls.name;
      const properties = Array.isArray(cls.properties) ? cls.properties : [];

      // Create Input
      sdl += `input Create${className}Input {\n`;
      for (const prop of properties) {
        const propName = prop.name;
        const isRequired = prop.required || false;
        const graphQLType = mapTypeToGraphQL(prop);
        const nullable = isRequired ? '!' : '';
        sdl += `  ${propName}: ${graphQLType}${nullable}\n`;
      }
      sdl += `}\n\n`;

      // Update Input (all fields optional)
      sdl += `input Update${className}Input {\n`;
      for (const prop of properties) {
        const propName = prop.name;
        const graphQLType = mapTypeToGraphQL(prop);
        sdl += `  ${propName}: ${graphQLType}\n`;
      }
      sdl += `}\n\n`;
    }
  }

  // Add scalar definitions for common types
  sdl += `# Custom scalar types\n`;
  sdl += `scalar DateTime\n`;
  sdl += `scalar JSON\n`;

  return sdl;
}

