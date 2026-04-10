/**
 * Send orchestrator: dispatches approved products to configured destinations.
 */

import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';
import { createTinyProduct } from './tiny';
import { createShopifyProduct } from './shopify';
import { createNuvemshopProduct } from './nuvemshop';

interface SendResult {
  tiny?: { success: boolean; id?: string; error?: string };
  shopify?: { success: boolean; id?: string; error?: string };
  nuvemshop?: { success: boolean; id?: string; error?: string };
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

  // Tiny ERP
  const sendToTiny = destinos.includes('tiny') && process.env.TINY_ERP_TOKEN;
  if (sendToTiny) {
    try {
      const r = await createTinyProduct(product);
      result.tiny = { success: r.success, id: r.tinyId, error: r.error };
    } catch (error) {
      result.tiny = { success: false, error: error instanceof Error ? error.message : 'Erro' };
    }
  }

  // Shopify
  const sendToShopify =
    destinos.includes('shopify') &&
    process.env.SHOPIFY_STORE_URL &&
    process.env.SHOPIFY_ACCESS_TOKEN;
  if (sendToShopify) {
    try {
      const r = await createShopifyProduct(product);
      result.shopify = { success: r.success, id: r.shopifyId, error: r.error };
    } catch (error) {
      result.shopify = { success: false, error: error instanceof Error ? error.message : 'Erro' };
    }
  }

  // Nuvemshop
  const sendToNuvemshop =
    destinos.includes('nuvemshop') &&
    process.env.NUVEMSHOP_STORE_ID &&
    process.env.NUVEMSHOP_ACCESS_TOKEN;
  if (sendToNuvemshop) {
    try {
      const r = await createNuvemshopProduct(product);
      result.nuvemshop = { success: r.success, id: r.nuvemshopId, error: r.error };
    } catch (error) {
      result.nuvemshop = { success: false, error: error instanceof Error ? error.message : 'Erro' };
    }
  }

  // Update product with send results
  const anySuccess =
    result.tiny?.success || result.shopify?.success || result.nuvemshop?.success;
  const anyError =
    (result.tiny && !result.tiny.success) ||
    (result.shopify && !result.shopify.success) ||
    (result.nuvemshop && !result.nuvemshop.success);

  await update(TABLES.PRODUCT_DRAFTS, productId, {
    status: anySuccess ? 'enviado' : anyError ? 'erro_envio' : 'aprovado',
    resultado_envio: JSON.stringify(result),
    enviado_at: anySuccess ? new Date().toISOString() : null,
    updated_at: new Date().toISOString(),
  });

  return result;
}
