/**
 * Integration config service.
 *
 * Priority order:
 *   1. DB (user_settings for the given userId) — encrypted tokens
 *   2. Env vars — server-level fallback
 *
 * userId = username (the stable identifier used across all tables).
 */

import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import { decrypt } from '@/lib/crypto';
import type { UserSettings } from '@/lib/types';

// Per-user settings cache: userId → { settings, time }
const cache = new Map<string, { settings: UserSettings; time: number }>();
const CACHE_TTL = 60_000; // 60 seconds

async function getSettings(userId: string): Promise<UserSettings | null> {
  const hit = cache.get(userId);
  if (hit && Date.now() - hit.time < CACHE_TTL) return hit.settings;

  try {
    const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
      where: `(user_id,eq,${userId})`,
      limit: 1,
    });
    if (result.list.length > 0) {
      cache.set(userId, { settings: result.list[0], time: Date.now() });
      return result.list[0];
    }
  } catch {
    // DB unavailable — fall through to env vars
  }
  return null;
}

export function invalidateConfigCache(userId?: string): void {
  if (userId) {
    cache.delete(userId);
  } else {
    cache.clear();
  }
}

// ==========================================
// Tiny ERP
// ==========================================

export async function getTinyToken(userId: string): Promise<string | null> {
  const settings = await getSettings(userId);
  if (settings?.tiny_token_encrypted) {
    const token = decrypt(settings.tiny_token_encrypted);
    if (token) return token;
  }
  return process.env.TINY_ERP_TOKEN || null;
}

// ==========================================
// Shopify
// ==========================================

export async function getShopifyConfig(
  userId: string
): Promise<{ storeUrl: string; token: string } | null> {
  const settings = await getSettings(userId);

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

export async function getNuvemshopConfig(
  userId: string
): Promise<{ storeId: string; token: string } | null> {
  const settings = await getSettings(userId);

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

export async function getIntegrationStatuses(userId: string) {
  const settings = await getSettings(userId);

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
