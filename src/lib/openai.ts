/**
 * OpenAI API wrapper for structured content generation.
 */

import OpenAI from 'openai';

let client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!client) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) throw new Error('OPENAI_API_KEY not set');
    client = new OpenAI({ apiKey });
  }
  return client;
}

export interface GenerateResult<T> {
  data: T;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

/**
 * Generate a JSON response from a structured prompt.
 * Returns both the parsed data and token usage.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2
): Promise<GenerateResult<T>> {
  const openai = getClient();

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o',
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 4000,
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) throw new Error('OpenAI returned empty content');

      const usage = completion.usage;

      return {
        data: JSON.parse(content) as T,
        usage: {
          prompt_tokens: usage?.prompt_tokens || 0,
          completion_tokens: usage?.completion_tokens || 0,
          total_tokens: usage?.total_tokens || 0,
        },
      };
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`OpenAI attempt ${attempt + 1} failed, retrying...`, error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error('OpenAI: max retries exceeded');
}
