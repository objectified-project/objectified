/**
 * Example test/demonstration of Arazzo spec generation
 * This shows what the output would look like for sample classes
 */

import { generateArazzoSpec } from './arazzo';

// Example class data
const sampleClasses = [
  {
    id: '1',
    name: 'Person',
    description: 'Represents a person entity',
    properties: [
      {
        id: 'p1',
        name: 'firstName',
        data: { type: 'string', description: 'First name' }
      },
      {
        id: 'p2',
        name: 'lastName',
        data: { type: 'string', description: 'Last name' }
      }
    ]
  },
  {
    id: '2',
    name: 'Address',
    description: 'Represents an address',
    properties: [
      {
        id: 'a1',
        name: 'street',
        data: { type: 'string' }
      },
      {
        id: 'a2',
        name: 'city',
        data: { type: 'string' }
      }
    ]
  }
];

// Generate the spec
const arazzoSpec = generateArazzoSpec(sampleClasses, {
  projectName: 'My API',
  version: '1.0.0',
  description: 'API workflow specifications'
});

console.log('Generated Arazzo Specification:');
console.log(arazzoSpec);

/**
 * Expected output structure:
 *
 * {
 *   "arazzo": "1.0.1",
 *   "info": {
 *     "title": "My API Workflows",
 *     "version": "1.0.0",
 *     "description": "API workflow specifications"
 *   },
 *   "sourceDescriptions": [
 *     {
 *       "name": "openapi-source",
 *       "type": "openapi",
 *       "url": "./openapi.json",
 *       "description": "OpenAPI specification containing schema definitions"
 *     }
 *   ],
 *   "workflows": [
 *     {
 *       "workflowId": "personWorkflow",
 *       "summary": "Person CRUD Workflow",
 *       "description": "Represents a person entity",
 *       "steps": [
 *         {
 *           "stepId": "createPerson",
 *           "description": "Create a new Person",
 *           "operationId": "createPerson",
 *           "parameters": [],
 *           "requestBody": {
 *             "contentType": "application/json",
 *             "payload": { "$ref": "#/components/schemas/Person" }
 *           },
 *           "successCriteria": [
 *             { "condition": "$statusCode == 201", "type": "simple" }
 *           ],
 *           "outputs": { "personId": "$response.body.id" }
 *         },
 *         {
 *           "stepId": "getPerson",
 *           "description": "Retrieve a Person by ID",
 *           "operationId": "getPersonById",
 *           "parameters": [
 *             {
 *               "name": "id",
 *               "in": "path",
 *               "value": "$steps.createPerson.outputs.personId"
 *             }
 *           ],
 *           "successCriteria": [
 *             { "condition": "$statusCode == 200", "type": "simple" }
 *           ],
 *           "dependsOn": ["createPerson"]
 *         },
 *         {
 *           "stepId": "updatePerson",
 *           "description": "Update an existing Person",
 *           "operationId": "updatePerson",
 *           "parameters": [
 *             {
 *               "name": "id",
 *               "in": "path",
 *               "value": "$steps.createPerson.outputs.personId"
 *             }
 *           ],
 *           "requestBody": {
 *             "contentType": "application/json",
 *             "payload": { "$ref": "#/components/schemas/Person" }
 *           },
 *           "successCriteria": [
 *             { "condition": "$statusCode == 200", "type": "simple" }
 *           ],
 *           "dependsOn": ["createPerson"]
 *         },
 *         {
 *           "stepId": "deletePerson",
 *           "description": "Delete a Person",
 *           "operationId": "deletePerson",
 *           "parameters": [
 *             {
 *               "name": "id",
 *               "in": "path",
 *               "value": "$steps.createPerson.outputs.personId"
 *             }
 *           ],
 *           "successCriteria": [
 *             { "condition": "$statusCode == 204", "type": "simple" }
 *           ],
 *           "dependsOn": ["updatePerson"]
 *         }
 *       ]
 *     },
 *     {
 *       "workflowId": "addressWorkflow",
 *       "summary": "Address CRUD Workflow",
 *       "description": "Represents an address",
 *       "steps": [...]
 *     }
 *   ]
 * }
 */

