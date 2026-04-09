import { z } from 'zod';

const envSchema = z.object({
  // NocoDB
  NOCODB_API_URL: z.string().url(),
  NOCODB_API_TOKEN: z.string().min(1),
  NOCODB_BASE_ID: z.string().min(1),

  // Auth
  NEXTAUTH_SECRET: z.string().min(1),
  NEXTAUTH_URL: z.string().url(),
  AUTH_USERNAME: z.string().min(1),
  AUTH_PASSWORD: z.string().min(1),

  // OpenAI
  OPENAI_API_KEY: z.string().startsWith('sk-'),

  // Firecrawl
  FIRECRAWL_API_KEY: z.string().startsWith('fc-'),

  // Tiny ERP (optional - configured later)
  TINY_ERP_TOKEN: z.string().optional(),

  // Shopify (optional - configured later)
  SHOPIFY_STORE_URL: z.string().optional(),
  SHOPIFY_ACCESS_TOKEN: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const missing = result.error.issues.map(
      (issue) => `  - ${issue.path.join('.')}: ${issue.message}`
    );
    throw new Error(
      `Missing or invalid environment variables:\n${missing.join('\n')}\n\n` +
        'Check your .env file or Coolify environment variables.'
    );
  }

  return result.data;
}

export const env = validateEnv();
