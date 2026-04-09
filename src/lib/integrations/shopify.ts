/**
 * Shopify Admin REST API integration.
 */

import type { ProductDraft, ProductVariation, ProductImage } from '@/lib/types';

function getConfig(): { storeUrl: string; token: string } {
  const storeUrl = process.env.SHOPIFY_STORE_URL;
  const token = process.env.SHOPIFY_ACCESS_TOKEN;
  if (!storeUrl || !token) throw new Error('SHOPIFY_STORE_URL and SHOPIFY_ACCESS_TOKEN must be set');
  return { storeUrl, token };
}

interface ShopifyProductResponse {
  product: {
    id: number;
    title: string;
    handle: string;
  };
}

/**
 * Create a product in Shopify.
 */
export async function createShopifyProduct(
  draft: ProductDraft
): Promise<{ success: boolean; shopifyId?: string; error?: string }> {
  const { storeUrl, token } = getConfig();

  const variacoes: ProductVariation[] = draft.variacoes
    ? JSON.parse(draft.variacoes)
    : [];

  const images: ProductImage[] = draft.imagens
    ? JSON.parse(draft.imagens)
    : [];

  // Build Shopify product payload
  const tags = draft.tags ? JSON.parse(draft.tags).join(', ') : '';
  const selectedImages = images.filter((img) => img.selecionada);

  const product: Record<string, unknown> = {
    title: draft.titulo,
    body_html: draft.descricao || '',
    vendor: draft.marca || '',
    product_type: draft.categoria || '',
    tags,
    status: 'draft', // Create as draft, user publishes manually
    images: selectedImages.map((img) => ({
      src: img.url,
    })),
  };

  // Add variants
  if (variacoes.length > 0) {
    product.options = [
      {
        name: draft.tipo_variacao || 'Variação',
        values: variacoes.map((v) => v.nome),
      },
    ];
    product.variants = variacoes.map((v) => ({
      option1: v.nome,
      price: String(v.preco || draft.preco_final || 0),
      sku: v.sku || '',
      barcode: v.ean || '',
      inventory_management: 'shopify',
    }));
  } else {
    // Single variant
    product.variants = [
      {
        price: String(draft.preco_final || draft.preco_sugerido || 0),
        sku: draft.sku || '',
        barcode: draft.ean || '',
        inventory_management: 'shopify',
      },
    ];
  }

  try {
    const res = await fetch(
      `https://${storeUrl}/admin/api/2024-01/products.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': token,
        },
        body: JSON.stringify({ product }),
      }
    );

    if (!res.ok) {
      const errorData = await res.text();
      return { success: false, error: `Shopify ${res.status}: ${errorData}` };
    }

    const data = (await res.json()) as ShopifyProductResponse;
    return {
      success: true,
      shopifyId: String(data.product.id),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}
