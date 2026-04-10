/**
 * Nuvemshop / Tiendanube API integration.
 * Docs: https://tiendanube.github.io/api-documentation/resources/product
 *
 * Auth: OAuth2 access token (non-expiring).
 * Base URL: https://api.nuvemshop.com.br/v1/{store_id}
 */

import type { ProductDraft, ProductVariation, ProductImage } from '@/lib/types';

function getConfig(): { baseUrl: string; token: string; userAgent: string } {
  const storeId = process.env.NUVEMSHOP_STORE_ID;
  const token = process.env.NUVEMSHOP_ACCESS_TOKEN;

  if (!storeId || !token) {
    throw new Error('NUVEMSHOP_STORE_ID and NUVEMSHOP_ACCESS_TOKEN must be set');
  }

  return {
    baseUrl: `https://api.nuvemshop.com.br/v1/${storeId}`,
    token,
    userAgent: 'CadastroInteligente (cadastro-inteligente@papelariaunicornio.com.br)',
  };
}

interface NuvemshopProductResponse {
  id: number;
  name: { pt: string };
  handle: { pt: string };
  variants: { id: number; sku: string }[];
}

/**
 * Create a product in Nuvemshop.
 */
export async function createNuvemshopProduct(
  draft: ProductDraft
): Promise<{ success: boolean; nuvemshopId?: string; error?: string }> {
  const { baseUrl, token, userAgent } = getConfig();

  const variacoes: ProductVariation[] = draft.variacoes
    ? JSON.parse(draft.variacoes)
    : [];

  const images: ProductImage[] = draft.imagens
    ? JSON.parse(draft.imagens)
    : [];

  const selectedImages = images
    .filter((img) => img.selecionada)
    .slice(0, 9); // Max 9 per API call

  const tags = draft.tags ? JSON.parse(draft.tags).join(', ') : '';

  // Build product payload
  const product: Record<string, unknown> = {
    name: { pt: draft.titulo },
    description: { pt: draft.descricao || '' },
    brand: draft.marca || '',
    tags,
    published: false, // Create as unpublished, user publishes manually
    requires_shipping: true,
    seo_title: (draft as ProductDraft & { titulo_seo?: string }).titulo_seo || draft.titulo.substring(0, 70),
    seo_description: (draft as ProductDraft & { descricao_seo?: string }).descricao_seo || (draft.descricao_curta || '').substring(0, 320),
    images: selectedImages.map((img) => ({ src: img.url })),
  };

  // Build variants
  if (variacoes.length > 0) {
    product.variants = variacoes.map((v) => ({
      price: String(draft.preco_final || draft.preco_sugerido || 0),
      sku: v.sku || '',
      barcode: v.ean || '',
      weight: draft.peso ? String(draft.peso) : undefined,
      height: draft.altura ? String(draft.altura) : undefined,
      width: draft.largura ? String(draft.largura) : undefined,
      depth: draft.profundidade ? String(draft.profundidade) : undefined,
      values: [{ pt: v.nome }],
    }));
  } else {
    // Single variant
    product.variants = [
      {
        price: String(draft.preco_final || draft.preco_sugerido || 0),
        sku: draft.sku || '',
        barcode: draft.ean || '',
        weight: draft.peso ? String(draft.peso) : undefined,
        height: draft.altura ? String(draft.altura) : undefined,
        width: draft.largura ? String(draft.largura) : undefined,
        depth: draft.profundidade ? String(draft.profundidade) : undefined,
      },
    ];
  }

  try {
    const res = await fetch(`${baseUrl}/products`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authentication': `bearer ${token}`,
        'User-Agent': userAgent,
      },
      body: JSON.stringify(product),
    });

    if (!res.ok) {
      const errorData = await res.text();
      return { success: false, error: `Nuvemshop ${res.status}: ${errorData}` };
    }

    const data = (await res.json()) as NuvemshopProductResponse;
    return {
      success: true,
      nuvemshopId: String(data.id),
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}
