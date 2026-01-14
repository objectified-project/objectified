/**
 * API route to fetch available Ollama models
 */

import { NextResponse } from 'next/server';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export async function GET() {
  try {
    const response = await fetch(`${OLLAMA_BASE_URL}/api/tags`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`Ollama API error: ${response.statusText}`);
    }

    const data = await response.json();
    return NextResponse.json({ success: true, models: data.models || [] });
  } catch (error: any) {
    console.error('Error fetching Ollama models:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch models' },
      { status: 500 }
    );
  }
}

