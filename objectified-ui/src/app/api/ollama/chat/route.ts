/**
 * API route to chat with Ollama using Server-Sent Events (SSE)
 */

import { NextRequest } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const { model, messages } = await request.json();

    if (!model || !messages || !Array.isArray(messages)) {
      return new Response(
        JSON.stringify({ error: 'Invalid request: model and messages are required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Create a system message to guide the LLM
    const systemMessage = {
      role: 'system',
      content: `You are an expert API designer and OpenAPI specification generator. Your task is to help users create OpenAPI 3.1.0 specifications based on their natural language descriptions.

# Rules

- Always generate valid OpenAPI 3.1.0 specifications
- When generating a complete specification, wrap it in a JSON code block: \`\`\`json\n{spec}\n\`\`\`
- Include proper info section with title, version, description, license, contact details
- Add servers section with at least one server URL (localhost is fine), and tags section with relevant tags
- Generate only schemas. Do not generate paths.
- Use components/schemas for all schema definitions
- Include appropriate HTTP methods and response codes
- Always generate descriptions and summaries to all properties and schemas
- Encourage using $ref for schema references when properties are reused
- Avoid duplicating properties: use $ref instead
- **CRITICAL: $ref must ONLY reference complete schemas in #/components/schemas, NEVER individual properties within a schema**
- **CORRECT: { "$ref": "#/components/schemas/User" }**
- **INCORRECT: { "$ref": "#/components/schemas/User/properties/email" }**
- **INCORRECT: { "$ref": "#/components/schemas/User#/properties/email" }**
- When you need to reference a class/schema, use: "#/components/schemas/ClassName"
- Use advanced schema features like patternProperties, discriminators, conditional rules, and allOf/oneOf/anyOf where applicable
- Be conversational and explain your design decisions
- Support incremental improvements to existing specs
- Do not generate clips of schemas in the response: The output should be the final schema
- Do not make up rules or paths that are not possible in OpenAPI 3.1.0

# Generation instructions

- Do not output or generate paths.
- Only generate a complete OpenAPI Specification with a \`#/components/schemas\` section.
- Schemas must include a summary and description
- Examples must be provided for all schemas and properties of type "object" where applicable, and must be "examples" as an array, not singular "example"
- Property names are camelCase
- Schema and Tag names are PascalCase
- Objects cannot be outside of the properties definitions - all objects must contain properties unless they are allOf/oneOf/anyOf discriminators
- **$ref MUST reference complete schemas only**: Use "#/components/schemas/ClassName" format
- **NEVER use $ref to reference properties**: Do not use "#/components/schemas/ClassName/properties/propertyName" or similar patterns

# Important

- Schema must contain "version: 3.1.0" at the root level
- All properties must include summaries and descriptions

Make adjustments to the schema as needed based on user feedback and requests for changes.  Provide no additional feedback,
commentary, or thinking output.`,
    };

    // Prepare messages with system prompt
    const fullMessages = [systemMessage, ...messages];

    // Make request to Ollama with streaming
    const ollamaResponse = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: fullMessages,
        stream: true,
      }),
    });

    if (!ollamaResponse.ok) {
      throw new Error(`Ollama API error: ${ollamaResponse.statusText}`);
    }

    // Create a TransformStream to process the streaming response
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaResponse.body?.getReader();
        if (!reader) {
          controller.close();
          return;
        }

        let buffer = '';

        try {
          while (true) {
            const { done, value } = await reader.read();

            if (done) {
              // Process any remaining buffer
              if (buffer.trim()) {
                try {
                  const data = JSON.parse(buffer);
                  if (data.message?.content) {
                    const event = {
                      content: data.message.content,
                      done: data.done || false,
                    };
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                  }
                } catch (e) {
                  // Ignore parse errors on final buffer
                }
              }

              // Send final event to signal completion
              controller.enqueue(encoder.encode('data: [DONE]\n\n'));
              controller.close();
              break;
            }

            // Decode the chunk with streaming enabled
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;

            // Process complete lines immediately (split by newline)
            const lines = buffer.split('\n');

            // Keep the last incomplete line in the buffer
            buffer = lines.pop() || '';

            // Process each complete line immediately
            for (const line of lines) {
              if (!line.trim()) continue;

              try {
                const data = JSON.parse(line);

                // Send the message content immediately if available
                if (data.message?.content) {
                  const event = {
                    content: data.message.content,
                    done: data.done || false,
                  };

                  // Enqueue immediately for real-time streaming
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
                }

                // If this is the last message, signal completion
                if (data.done) {
                  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
                  controller.close();
                  return;
                }
              } catch (parseError) {
                console.error('Error parsing Ollama response line:', parseError, 'Line:', line);
              }
            }
          }
        } catch (error) {
          console.error('Error reading stream:', error);
          controller.error(error);
        }
      },
    });

    // Return SSE response
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });
  } catch (error: any) {
    console.error('Error in Ollama chat:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Failed to process chat request' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

