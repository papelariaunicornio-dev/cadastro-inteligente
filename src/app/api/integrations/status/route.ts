import { NextResponse } from 'next/server';

/**
 * Returns which integrations are configured.
 * Never exposes actual values or env var names.
 */
export async function GET() {
  return NextResponse.json({
    tiny: {
      configured: !!process.env.TINY_ERP_TOKEN,
      label: 'Tiny ERP v2',
    },
    shopify: {
      configured: !!(process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN),
      label: 'Shopify',
    },
    nuvemshop: {
      configured: !!(process.env.NUVEMSHOP_STORE_ID && process.env.NUVEMSHOP_ACCESS_TOKEN),
      label: 'Nuvemshop',
    },
    firecrawl: {
      configured: !!process.env.FIRECRAWL_API_KEY,
      label: 'Firecrawl',
    },
    openai: {
      configured: !!process.env.OPENAI_API_KEY,
      label: 'OpenAI',
    },
  });
}
