import { NextRequest, NextResponse } from 'next/server';
import { validateSku } from '@/lib/rules/sku-rules';
import { validateTitle } from '@/lib/rules/title-rules';
import { validatePricing, psychologicalRound } from '@/lib/rules/pricing-rules';

/**
 * Real-time validation endpoint.
 * POST with { type: 'sku' | 'title' | 'pricing', data: {...} }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, data } = body;

    switch (type) {
      case 'sku': {
        const result = validateSku(data.sku || '', data.existingSkus || []);
        return NextResponse.json(result);
      }

      case 'title': {
        const result = validateTitle(data.title || '', {
          channel: data.channel,
          keyword: data.keyword,
          marca: data.marca,
        });
        return NextResponse.json(result);
      }

      case 'pricing': {
        const result = validatePricing({
          custoUnitario: data.custoUnitario || 0,
          custoComIpi: data.custoComIpi || 0,
          freteMedio: data.freteMedio || 0,
          precoVenda: data.precoVenda || 0,
          aliquotaImpostos: data.aliquotaImpostos || 6,
          comissaoCanal: data.comissaoCanal || 0,
          taxaPagamento: data.taxaPagamento || 0,
          margemMinima: data.margemMinima || 10,
          margemMeta: data.margemMeta,
          precoMedioMercado: data.precoMedioMercado,
        });
        return NextResponse.json(result);
      }

      case 'round': {
        const rounded = psychologicalRound(data.price || 0);
        return NextResponse.json({ original: data.price, rounded });
      }

      default:
        return NextResponse.json({ error: 'Tipo inválido' }, { status: 400 });
    }
  } catch (error) {
    console.error('Validation error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro na validação' }, { status: 500 });
  }
}
