/**
 * Price calculation engine using reverse markup formula.
 */

import type { PriceComposition, ScrapedData, NfItem } from '@/lib/types';

interface PriceSettings {
  aliquota_impostos: number;   // % (e.g., 6)
  margem_desejada: number;     // % (e.g., 40)
  comissao_ecommerce: number;  // % (e.g., 0)
  frete_medio_unidade: number; // R$ (e.g., 2.50)
  taxas_fixas: number;         // R$ (e.g., 0)
}

const DEFAULT_SETTINGS: PriceSettings = {
  aliquota_impostos: 6,
  margem_desejada: 40,
  comissao_ecommerce: 0,
  frete_medio_unidade: 0,
  taxas_fixas: 0,
};

/**
 * Calculate unit cost from NF item data.
 */
export function calculateUnitCost(item: NfItem): {
  custoUnitario: number;
  custoComIpi: number;
} {
  const und = item.unidades_por_item || 1;
  const custoUnitario = Number(item.valor_produto) / (Number(item.quantidade) * und);
  const custoComIpi = (Number(item.valor_produto) + Number(item.valor_ipi)) / (Number(item.quantidade) * und);

  return {
    custoUnitario: Math.round(custoUnitario * 100) / 100,
    custoComIpi: Math.round(custoComIpi * 100) / 100,
  };
}

/**
 * Calculate suggested price using reverse markup formula.
 *
 * Formula: precoVenda = baseCusto / (1 - margem - impostos - comissao)
 */
export function calculateSuggestedPrice(
  custoComIpi: number,
  settings: Partial<PriceSettings> = {}
): PriceComposition {
  const s = { ...DEFAULT_SETTINGS, ...settings };

  const freteEstimado = s.frete_medio_unidade;
  const baseCusto = custoComIpi + freteEstimado + s.taxas_fixas;

  const margemPct = s.margem_desejada / 100;
  const impostosPct = s.aliquota_impostos / 100;
  const comissaoPct = s.comissao_ecommerce / 100;

  const divisor = 1 - margemPct - impostosPct - comissaoPct;

  if (divisor <= 0) {
    // Margins too high — fallback to simple markup
    const precoFinal = baseCusto * 2.5;
    return {
      custo_unitario: custoComIpi - (custoComIpi > freteEstimado ? 0 : 0),
      custo_com_ipi: custoComIpi,
      frete_estimado: freteEstimado,
      impostos_venda: round(precoFinal * impostosPct),
      impostos_venda_pct: s.aliquota_impostos,
      comissao: round(precoFinal * comissaoPct),
      comissao_pct: s.comissao_ecommerce,
      margem: round(precoFinal - baseCusto - precoFinal * impostosPct - precoFinal * comissaoPct),
      margem_pct: s.margem_desejada,
      preco_final: round(precoFinal),
    };
  }

  const precoFinal = baseCusto / divisor;

  return {
    custo_unitario: custoComIpi,
    custo_com_ipi: custoComIpi,
    frete_estimado: freteEstimado,
    impostos_venda: round(precoFinal * impostosPct),
    impostos_venda_pct: s.aliquota_impostos,
    comissao: round(precoFinal * comissaoPct),
    comissao_pct: s.comissao_ecommerce,
    margem: round(precoFinal * margemPct),
    margem_pct: s.margem_desejada,
    preco_final: round(precoFinal),
  };
}

/**
 * Calculate average price from scraped data by category.
 */
export function calculateAveragePrices(scrapedData: ScrapedData[]): {
  ecommerce: number | null;
  marketplace: number | null;
} {
  const ecommercePrices = scrapedData
    .filter((d) => d.tipo === 'ecommerce' && d.preco)
    .map((d) => d.preco!);

  const marketplacePrices = scrapedData
    .filter((d) => d.tipo === 'marketplace' && d.preco)
    .map((d) => d.preco!);

  return {
    ecommerce:
      ecommercePrices.length > 0
        ? round(ecommercePrices.reduce((a, b) => a + b, 0) / ecommercePrices.length)
        : null,
    marketplace:
      marketplacePrices.length > 0
        ? round(marketplacePrices.reduce((a, b) => a + b, 0) / marketplacePrices.length)
        : null,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}
