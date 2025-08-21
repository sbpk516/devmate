import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createOpenAIClient } from '@/lib/openai';
import { createSSEResponse, createSSEMessage, createSSEEnd } from '@/lib/sse';
import { ALLOWED_MODELS, ChatRequest, ChatResponse, ChatError } from '@/lib/types';

// Input validation schema
const chatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt must be 4000 characters or less'),
  system: z.string().max(2000, 'System message must be 2000 characters or less').optional(),
  model: z.enum(['gpt-4o-mini', 'gpt-4o'] as const).optional(),
  stream: z.boolean().optional(),
});

export async function POST(request: NextRequest) {
  const startTime = performance.now();
  
  try {
    // CORS check
    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'];
    const origin = request.headers.get('origin');
    
    if (origin && !allowedOrigins.includes(origin)) {
      return NextResponse.json(
        { error: 'CORS_ERROR', message: 'Origin not allowed' },
        { status: 403 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const validatedData = chatRequestSchema.parse(body);
    
    const { prompt, system, model = 'gpt-4o', stream = true } = validatedData;
    
    // Create OpenAI client
    const client = await createOpenAIClient();
    
    // Prepare messages
    const messages = [];
    if (system) {
      messages.push({ role: 'system' as const, content: system });
    }
    messages.push({ role: 'user' as const, content: prompt });
    
    // Get max tokens from env, clamp to 1024
    const maxTokens = Math.min(parseInt(process.env.MAX_TOKENS || '500'), 1024);
    
    // Prepare request options
    const requestOptions: any = {
      model,
      messages,
      max_tokens: maxTokens,
      stream,
    };
    
    // Headers are now set in the client's defaultHeaders
    
    if (stream) {
      // Streaming response
      const streamResponse = await client.chat.completions.create(requestOptions);
      
      const readableStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamResponse as any) {
              const delta = chunk.choices[0]?.delta?.content;
              if (delta) {
                controller.enqueue(
                  new TextEncoder().encode(createSSEMessage({ content: delta }))
                );
              }
            }
            controller.enqueue(new TextEncoder().encode(createSSEEnd()));
          } catch (error) {
            console.error('Streaming error:', error);
            controller.error(error);
          } finally {
            controller.close();
          }
        },
      });
      
      return createSSEResponse(readableStream);
    } else {
      // Non-streaming response
      const completion = await client.chat.completions.create(requestOptions);
      
      const latencyMs = Math.round(performance.now() - startTime);
      
      const response: ChatResponse = {
        content: completion.choices[0]?.message?.content || '',
        model: completion.model,
        usage: completion.usage || undefined,
        latencyMs,
      };
      
      return NextResponse.json(response);
    }
  } catch (error) {
    const latencyMs = Math.round(performance.now() - startTime);
    
    console.error('Chat API error:', error);
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'VALIDATION_ERROR', message: error.errors[0]?.message || 'Invalid input' },
        { status: 400 }
      );
    }
    
    if (error instanceof Error) {
      if (error.message.includes('OPENAI_API_KEY') || error.message.includes('CLIENT_ID') || error.message.includes('CLIENT_SECRET')) {
        return NextResponse.json(
          { error: 'CONFIG_ERROR', message: error.message },
          { status: 500 }
        );
      }
      
      if (error.message.includes('rate limit')) {
        return NextResponse.json(
          { error: 'RATE_LIMIT', message: 'Rate limit exceeded' },
          { status: 429 }
        );
      }
      
      if (error.message.includes('authentication') || error.message.includes('Failed to authenticate')) {
        return NextResponse.json(
          { error: 'AUTH_ERROR', message: 'Authentication failed' },
          { status: 401 }
        );
      }
    }
    
    return NextResponse.json(
      { error: 'INTERNAL_ERROR', message: 'Internal server error' },
      { status: 500 }
    );
  }
}
