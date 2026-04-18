/**
 * Integration config service.
 *
 * Priority order:
 *   1. DB (user_settings) — encrypted tokens, decrypted at runtime
 *   2. Env vars — fallback for server-side config (Coolify)
 *
 * Never exposes plaintext tokens outside this module.
 */

import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import { decrypt } from '@/lib/crypto';
import type { UserSettings } from '@/lib/types';

// Simple in-process cache so we don't hit NocoDB on every request.
// Invalidated after 60s or when config is updated.
let cache: UserSettings | null = null;
let cacheTime = 0;
const CACHE_TTL = 60_000; // 60 seconds

async function getSettings(): Promise<UserSettings | null> {
  if (cache && Date.now() - cacheTime < CACHE_TTL) return cache;

  try {
    const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
      where: '(user_id,eq,admin)',
      limit: 1,
    });
    if (result.list.length > 0) {
      cache = result.list[0];
      cacheTime = Date.now();
      return cache;
    }
  } catch {
    // If DB is unavailable, fall through to env vars
  }
  return null;
}

export function invalidateConfigCache(): void {
  cache = null;
  cacheTime = 0;
}

// ==========================================
// Tiny ERP
// ==========================================

export async function getTinyToken(): Promise<string | null> {
  const settings = await getSettings();
  if (settings?.tiny_token_encrypted) {
    const token = decrypt(settings.tiny_token_encrypted);
    if (token) return token;
  }
  return process.env.TINY_ERP_TOKEN || null;
}

// ==========================================
// Shopify
// ==========================================

export async function getShopifyConfig(): Promise<{ storeUrl: string; token: string } | null> {
  const settings = await getSettings();

  const storeUrl = settings?.shopify_url || process.env.SHOPIFY_STORE_URL || null;
  let token: string | null = null;

  if (settings?.shopify_token_encrypted) {
    token = decrypt(settings.shopify_token_encrypted);
  }
  if (!token) token = process.env.SHOPIFY_ACCESS_TOKEN || null;

  if (storeUrl && token) return { storeUrl, token };
  return null;
}

// ==========================================
// Nuvemshop
// ==========================================

export async function getNuvemshopConfig(): Promise<{ storeId: string; token: string } | null> {
  const settings = await getSettings();

  const storeId = settings?.nuvemshop_store_id || process.env.NUVEMSHOP_STORE_ID || null;
  let token: string | null = null;

  if (settings?.nuvemshop_token_encrypted) {
    token = decrypt(settings.nuvemshop_token_encrypted);
  }
  if (!token) token = process.env.NUVEMSHOP_ACCESS_TOKEN || null;

  if (storeId && token) return { storeId, token };
  return null;
}

// ==========================================
// Status helpers (for UI display)
// ==========================================

export async function getIntegrationStatuses() {
  const settings = await getSettings();

  const tinyToken = settings?.tiny_token_encrypted
    ? decrypt(settings.tiny_token_encrypted)
    : null;

  const shopifyToken = settings?.shopify_token_encrypted
    ? decrypt(settings.shopify_token_encrypted)
    : null;

  const nuvemshopToken = settings?.nuvemshop_token_encrypted
    ? decrypt(settings.nuvemshop_token_encrypted)
    : null;

  return {
    tiny: {
      configured: !!(tinyToken || process.env.TINY_ERP_TOKEN),
      source: tinyToken ? 'db' : (process.env.TINY_ERP_TOKEN ? 'env' : null),
    },
    shopify: {
      configured: !!((shopifyToken || process.env.SHOPIFY_ACCESS_TOKEN) &&
        (settings?.shopify_url || process.env.SHOPIFY_STORE_URL)),
      source: shopifyToken ? 'db' : (process.env.SHOPIFY_ACCESS_TOKEN ? 'env' : null),
      storeUrl: settings?.shopify_url || process.env.SHOPIFY_STORE_URL || null,
    },
    nuvemshop: {
      configured: !!((nuvemshopToken || process.env.NUVEMSHOP_ACCESS_TOKEN) &&
        (settings?.nuvemshop_store_id || process.env.NUVEMSHOP_STORE_ID)),
      source: nuvemshopToken ? 'db' : (process.env.NUVEMSHOP_ACCESS_TOKEN ? 'env' : null),
      storeId: settings?.nuvemshop_store_id || process.env.NUVEMSHOP_STORE_ID || null,
    },
  };
}
