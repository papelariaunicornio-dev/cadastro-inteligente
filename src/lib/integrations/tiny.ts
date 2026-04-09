/**
 * Tiny ERP API v2 integration.
 * Docs: https://tiny.com.br/api-docs
 */

import type { ProductDraft, ProductVariation } from '@/lib/types';

const TINY_API_BASE = 'https://api.tiny.com.br/api2';

function getToken(): string {
  const token = process.env.TINY_ERP_TOKEN;
  if (!token) throw new Error('TINY_ERP_TOKEN not set');
  return token;
}

interface TinyResponse {
  retorno: {
    status_processamento: string; // "1" | "2" | "3"
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
  const token = getToken();

  const variacoes: ProductVariation[] = draft.variacoes
    ? JSON.parse(draft.variacoes)
    : [];

  // Build Tiny product XML format (Tiny v2 uses form-encoded with XML)
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
    situacao: 'A', // Ativo
    tipo: 'P', // Produto
  };

  // Add variations if applicable
  if (variacoes.length > 0) {
    produto.variacoes = variacoes.map((v, i) => ({
      variacao: {
        codigo: v.sku || `${draft.sku}-${i + 1}`,
        grade: {
          [draft.tipo_variacao || 'Variação']: v.nome,
        },
        gtin: v.ean || '',
        preco: v.preco || draft.preco_final || 0,
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
      error: error instanceof Error ? error.message : 'Erro de conexão',
    };
  }
}
