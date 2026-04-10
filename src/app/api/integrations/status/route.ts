import { NextResponse } from 'next/server';

/**
 * Returns which integrations are configured via env vars.
 * Never exposes actual token values — only configured/not status.
 */
export async function GET() {
  return NextResponse.json({
    tiny: {
      configured: !!process.env.TINY_ERP_TOKEN,
      label: 'Tiny ERP v2',
      envVar: 'TINY_ERP_TOKEN',
    },
    shopify: {
      configured: !!(process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN),
      label: 'Shopify',
      envVars: ['SHOPIFY_STORE_URL', 'SHOPIFY_ACCESS_TOKEN'],
      storeUrl: process.env.SHOPIFY_STORE_URL || null,
    },
    firecrawl: {
      configured: !!process.env.FIRECRAWL_API_KEY,
      label: 'Firecrawl',
      envVar: 'FIRECRAWL_API_KEY',
    },
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      label: 'OpenAI',
      envVar: 'OPENAI_API_KEY',
    },
  });
}
