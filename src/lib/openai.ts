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

/**
 * Generate a JSON response from a structured prompt.
 * Retries up to `maxRetries` times on parse failures.
 */
export async function generateJSON<T>(
  systemPrompt: string,
  userPrompt: string,
  maxRetries = 2
): Promise<T> {
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

      return JSON.parse(content) as T;
    } catch (error) {
      if (attempt === maxRetries) throw error;
      console.warn(`OpenAI attempt ${attempt + 1} failed, retrying...`, error);
      await new Promise((r) => setTimeout(r, 1000));
    }
  }

  throw new Error('OpenAI: max retries exceeded');
}
