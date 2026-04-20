import { NextRequest, NextResponse } from 'next/server';
import { getIntegrationStatuses } from '@/lib/integrations/config';
import { isEncryptionAvailable } from '@/lib/crypto';
import { requireAuth } from '@/lib/session';

/**
 * Returns integration status — configured yes/no, source (db/env).
 * Never exposes tokens or env var names.
 */
export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const statuses = await getIntegrationStatuses(auth.user.id);

    return NextResponse.json({
      tiny: {
        ...statuses.tiny,
        label: 'Tiny ERP v2',
        configurable: true,
      },
      shopify: {
        ...statuses.shopify,
        label: 'Shopify',
        configurable: true,
      },
      nuvemshop: {
        ...statuses.nuvemshop,
        label: 'Nuvemshop',
        configurable: true,
      },
      firecrawl: {
        configured: !!process.env.FIRECRAWL_API_KEY,
        source: process.env.FIRECRAWL_API_KEY ? 'env' : null,
        label: 'Firecrawl',
        configurable: false,
      },
      openai: {
        configured: !!process.env.OPENAI_API_KEY,
        source: process.env.OPENAI_API_KEY ? 'env' : null,
        label: 'OpenAI',
        configurable: false,
      },
      encryptionAvailable: isEncryptionAvailable(),
    });
  } catch (error) {
    console.error('Integration status error:', error);
    // Fallback to env-only check
    return NextResponse.json({
      tiny: { configured: !!process.env.TINY_ERP_TOKEN, source: 'env', label: 'Tiny ERP v2', configurable: true },
      shopify: {
        configured: !!(process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN),
        source: 'env',
        label: 'Shopify',
        configurable: true,
      },
      nuvemshop: {
        configured: !!(process.env.NUVEMSHOP_STORE_ID && process.env.NUVEMSHOP_ACCESS_TOKEN),
        source: 'env',
        label: 'Nuvemshop',
        configurable: true,
      },
      firecrawl: { configured: !!process.env.FIRECRAWL_API_KEY, source: 'env', label: 'Firecrawl', configurable: false },
      openai: { configured: !!process.env.OPENAI_API_KEY, source: 'env', label: 'OpenAI', configurable: false },
      encryptionAvailable: isEncryptionAvailable(),
    });
  }
}
