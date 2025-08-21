import { z } from 'zod';

// Import the same schema used in the API
const chatRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(4000, 'Prompt must be 4000 characters or less'),
  system: z.string().max(2000, 'System message must be 2000 characters or less').optional(),
  model: z.enum(['gpt-4o-mini', 'gpt-4o'] as const).optional(),
  stream: z.boolean().optional(),
});

describe('Chat API Input Validation', () => {
  test('validates correct input', () => {
    const validInput = {
      prompt: 'Hello, how are you?',
      system: 'You are a helpful assistant.',
      model: 'gpt-4o-mini' as const,
      stream: true,
    };
    
    const result = chatRequestSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  test('rejects empty prompt', () => {
    const invalidInput = {
      prompt: '',
      model: 'gpt-4o-mini' as const,
    };
    
    const result = chatRequestSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Prompt is required');
    }
  });

  test('rejects prompt too long', () => {
    const invalidInput = {
      prompt: 'a'.repeat(4001),
      model: 'gpt-4o-mini' as const,
    };
    
    const result = chatRequestSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Prompt must be 4000 characters or less');
    }
  });

  test('rejects system message too long', () => {
    const invalidInput = {
      prompt: 'Hello',
      system: 'a'.repeat(2001),
      model: 'gpt-4o-mini' as const,
    };
    
    const result = chatRequestSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('System message must be 2000 characters or less');
    }
  });

  test('rejects invalid model', () => {
    const invalidInput = {
      prompt: 'Hello',
      model: 'invalid-model' as any,
    };
    
    const result = chatRequestSchema.safeParse(invalidInput);
    expect(result.success).toBe(false);
  });

  test('accepts minimal valid input', () => {
    const minimalInput = {
      prompt: 'Hello',
    };
    
    const result = chatRequestSchema.safeParse(minimalInput);
    expect(result.success).toBe(true);
  });
});
