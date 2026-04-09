/**
 * Send orchestrator: dispatches approved products to configured destinations.
 */

import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';
import { createTinyProduct } from './tiny';
import { createShopifyProduct } from './shopify';

interface SendResult {
  tiny?: { success: boolean; id?: string; error?: string };
  shopify?: { success: boolean; id?: string; error?: string };
}

/**
 * Send a product to all configured destinations.
 */
export async function sendProduct(productId: number | string): Promise<SendResult> {
  const product = await get<ProductDraft>(TABLES.PRODUCT_DRAFTS, productId);
  const result: SendResult = {};

  const destinos: string[] = product.destino_envio
    ? JSON.parse(product.destino_envio)
    : [];

  // If no destinations configured, try both if tokens are available
  const sendToTiny = destinos.includes('tiny') || process.env.TINY_ERP_TOKEN;
  const sendToShopify =
    destinos.includes('shopify') ||
    (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN);

  if (sendToTiny && process.env.TINY_ERP_TOKEN) {
    try {
      const tinyResult = await createTinyProduct(product);
      result.tiny = {
        success: tinyResult.success,
        id: tinyResult.tinyId,
        error: tinyResult.error,
      };
    } catch (error) {
      result.tiny = {
        success: false,
        error: error instanceof Error ? error.message : 'Erro',
      };
    }
  }

  if (sendToShopify && process.env.SHOPIFY_STORE_URL) {
    try {
      const shopifyResult = await createShopifyProduct(product);
      result.shopify = {
        success: shopifyResult.success,
        id: shopifyResult.shopifyId,
        error: shopifyResult.error,
      };
    } catch (error) {
      result.shopify = {
        success: false,
        error: error instanceof Error ? error.message : 'Erro',
      };
    }
  }

  // Update product with send results
  const anySuccess =
    result.tiny?.success || result.shopify?.success;
  const anyError =
    (result.tiny && !result.tiny.success) ||
    (result.shopify && !result.shopify.success);

  await update(TABLES.PRODUCT_DRAFTS, productId, {
    status: anySuccess ? 'enviado' : anyError ? 'erro_envio' : 'aprovado',
    resultado_envio: JSON.stringify(result),
    enviado_at: anySuccess ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });

  return result;
}
