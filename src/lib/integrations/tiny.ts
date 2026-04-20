/**
 * Tiny ERP API v2 integration.
 * Docs: https://tiny.com.br/api-docs/api2-produtos-incluir
 *
 * Campos mapeados:
 * - codigo → SKU
 * - codigo_pelo_fornecedor → cProd da NF (código do produto no fornecedor)
 * - nome → título
 * - descricao_complementar → descrição curta
 * - marca, ncm, gtin, peso
 * - seo → titulo_seo, palavras_chave, descricao_seo, slug
 * - variacoes → com grade e gtin
 */

import type { ProductDraft, ProductVariation } from '@/lib/types';
import { getTinyToken } from './config';

const TINY_API_BASE = 'https://api.tiny.com.br/api2';

interface TinyResponse {
  retorno: {
    status_processamento: string;
    status: string;
    registros?: {
      registro: {
        id: string;
        sequencia: string;
      };
    }[];
    erros?: {
      erro: string;
    }[];
  };
}

/**
 * Create a product in Tiny ERP.
 */
export async function createTinyProduct(
  draft: ProductDraft
): Promise<{ success: boolean; tinyId?: string; error?: string }> {
  const token = await getTinyToken(draft.user_id || 'admin');
  if (!token) return { success: false, error: 'Token Tiny ERP não configurado' };

  const variacoes: ProductVariation[] = draft.variacoes
    ? JSON.parse(draft.variacoes)
    : [];

  // SEO fields
  const extra = draft as ProductDraft & {
    titulo_seo?: string;
    descricao_seo?: string;
    palavras_chave?: string;
  };

  // Build product payload
  const produto: Record<string, unknown> = {
    sequencia: 1,
    codigo: draft.sku || '',
    nome: draft.titulo,
    unidade: 'UN',
    preco: draft.preco_final || draft.preco_sugerido || 0,
    ncm: draft.ncm || '',
    gtin: draft.ean || '',
    marca: draft.marca || '',
    descricao_complementar: draft.descricao_curta || '',
    peso_bruto: draft.peso || 0,
    peso_liquido: draft.peso || 0,
    situacao: 'A',
    tipo: 'P',
    estoque_atual: draft.estoque || 0,

    // Supplier data (from NF)
    codigo_pelo_fornecedor: draft.codigo_fornecedor || '',

    // Packaging dimensions
    altura_embalagem: draft.altura || 0,
    largura_embalagem: draft.largura || 0,
    comprimento_embalagem: draft.profundidade || 0,

    // Category
    categoria: draft.categoria || '',
  };

  // SEO object
  if (extra.titulo_seo || extra.palavras_chave || extra.descricao_seo) {
    produto.seo = {
      title: extra.titulo_seo || draft.titulo,
      keywords: extra.palavras_chave || '',
      description: extra.descricao_seo || draft.descricao_curta || '',
      slug: (extra.titulo_seo || draft.titulo)
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, ''),
    };
  }

  // Tags
  if (draft.tags) {
    try {
      const tags: string[] = JSON.parse(draft.tags);
      if (tags.length > 0) {
        produto.tags = tags.map((tag) => ({ tag }));
      }
    } catch { /* ignore */ }
  }

  // Images as anexos (selected images only)
  if (draft.imagens) {
    try {
      const imgs = JSON.parse(draft.imagens);
      const selected = imgs.filter((img: { selecionada: boolean; url: string }) =>
        img.selecionada && img.url.startsWith('http')
      );
      if (selected.length > 0) {
        produto.anexos = selected.map((img: { url: string }) => ({
          anexo: img.url,
        }));
      }
    } catch { /* ignore */ }
  }

  // Variations
  if (variacoes.length > 0) {
    produto.variacoes = variacoes.map((v, i) => ({
      variacao: {
        codigo: v.sku || `${draft.sku}-${i + 1}`,
        grade: {
          [draft.tipo_variacao || 'Variacao']: v.nome,
        },
        gtin: v.ean || '',
        preco: v.preco || draft.preco_final || 0,
        estoque_atual: v.estoque || 0,
      },
    }));
  }

  try {
    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('formato', 'JSON');
    formData.append('produto', JSON.stringify({ produtos: [{ produto }] }));

    const res = await fetch(`${TINY_API_BASE}/produto.incluir.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    });

    const data = (await res.json()) as TinyResponse;

    if (data.retorno.status_processamento === '3') {
      const tinyId = data.retorno.registros?.[0]?.registro?.id;
      return { success: true, tinyId };
    }

    const errors = data.retorno.erros?.map((e) => e.erro).join('; ');
    return {
      success: false,
      error: errors || data.retorno.status || 'Erro desconhecido',
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Erro de conexao',
    };
  }
}
