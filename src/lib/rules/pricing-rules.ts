/**
 * Pricing Rules Engine
 *
 * Validates prices, enforces guard-rails, applies psychological rounding,
 * calculates pricing score. Prevents negative margins and price below floor.
 */

// ==========================================
// Types
// ==========================================

export interface PricingValidation {
  valid: boolean;
  score: number;
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  flags: PricingFlag[];
  breakdown: {
    margemSaude: number;       // 0-40
    competitividade: number;   // 0-30
    riscoOperacional: number;  // 0-20
    governanca: number;        // 0-10
  };
  guardrails: {
    precoMinimo: number;
    precoMaximo: number | null;
    margemLiquida: number;
    margemLiquidaPct: number;
  };
  precoArredondado: number;
}

export interface PricingFlag {
  severity: 'critica' | 'alta' | 'media' | 'baixa' | 'alerta';
  code: string;
  message: string;
}

export interface PricingParams {
  custoUnitario: number;
  custoComIpi: number;
  freteMedio: number;
  precoVenda: number;
  // Rates (as percentages, e.g. 6 for 6%)
  aliquotaImpostos: number;
  comissaoCanal: number;
  taxaPagamento?: number;
  margemMinima: number;
  margemMeta?: number;
  // Competitive data (optional)
  precoMedioMercado?: number | null;
  precoMinimoMercado?: number | null;
  precoMaximoMercado?: number | null;
}

// ==========================================
// Guard-rails
// ==========================================

/**
 * Calculate the absolute minimum price (floor) to guarantee margin.
 * Formula: CTU / (1 - T% - margin%)
 * Where CTU = custo + frete, T% = impostos + comissão + pagamento
 */
export function calculatePriceFloor(params: {
  custoComIpi: number;
  freteMedio: number;
  aliquotaImpostos: number;
  comissaoCanal: number;
  taxaPagamento?: number;
  margemMinima: number;
}): number {
  const ctu = params.custoComIpi + params.freteMedio;
  const taxTotal =
    params.aliquotaImpostos / 100 +
    params.comissaoCanal / 100 +
    (params.taxaPagamento || 0) / 100;
  const margemPct = params.margemMinima / 100;

  const divisor = 1 - taxTotal - margemPct;

  if (divisor <= 0) {
    // Margins + taxes exceed 100% — impossible to price profitably
    // Return cost * 3 as a safety fallback
    return Math.ceil(ctu * 3 * 100) / 100;
  }

  return Math.ceil((ctu / divisor) * 100) / 100;
}

/**
 * Calculate actual margin for a given price.
 */
export function calculateMargin(params: {
  custoComIpi: number;
  freteMedio: number;
  precoVenda: number;
  aliquotaImpostos: number;
  comissaoCanal: number;
  taxaPagamento?: number;
}): { margemLiquida: number; margemLiquidaPct: number } {
  const ctu = params.custoComIpi + params.freteMedio;
  const impostos = params.precoVenda * (params.aliquotaImpostos / 100);
  const comissao = params.precoVenda * (params.comissaoCanal / 100);
  const pagamento = params.precoVenda * ((params.taxaPagamento || 0) / 100);

  const margemLiquida = params.precoVenda - ctu - impostos - comissao - pagamento;
  const margemLiquidaPct = params.precoVenda > 0
    ? (margemLiquida / params.precoVenda) * 100
    : 0;

  return {
    margemLiquida: Math.round(margemLiquida * 100) / 100,
    margemLiquidaPct: Math.round(margemLiquidaPct * 100) / 100,
  };
}

// ==========================================
// Psychological Rounding
// ==========================================

/**
 * Round price to end in .90 or .99 (psychological pricing).
 */
export function psychologicalRound(price: number): number {
  const intPart = Math.floor(price);
  const decimal = price - intPart;

  if (decimal <= 0.45) {
    // Round down to .90 of previous integer (or up to .90 if close)
    return intPart - 0.10;
  } else if (decimal <= 0.94) {
    return intPart + 0.90;
  } else {
    return intPart + 0.99;
  }
}

// ==========================================
// Full Validation
// ==========================================

export function validatePricing(params: PricingParams): PricingValidation {
  const flags: PricingFlag[] = [];
  const breakdown = {
    margemSaude: 0,
    competitividade: 0,
    riscoOperacional: 20,
    governanca: 10,
  };

  // Calculate floor price
  const precoMinimo = calculatePriceFloor({
    custoComIpi: params.custoComIpi,
    freteMedio: params.freteMedio,
    aliquotaImpostos: params.aliquotaImpostos,
    comissaoCanal: params.comissaoCanal,
    taxaPagamento: params.taxaPagamento,
    margemMinima: params.margemMinima,
  });

  // Calculate actual margin
  const { margemLiquida, margemLiquidaPct } = calculateMargin({
    custoComIpi: params.custoComIpi,
    freteMedio: params.freteMedio,
    precoVenda: params.precoVenda,
    aliquotaImpostos: params.aliquotaImpostos,
    comissaoCanal: params.comissaoCanal,
    taxaPagamento: params.taxaPagamento,
  });

  // Psychological rounding
  const precoArredondado = psychologicalRound(params.precoVenda);

  // === MARGEM & SAÚDE FINANCEIRA (0-40) ===
  const margemMeta = params.margemMeta || params.margemMinima * 1.5;

  if (margemLiquidaPct < 0) {
    // Negative margin — critical
    flags.push({
      severity: 'critica',
      code: 'PRICE_NEGATIVE_MARGIN',
      message: `Margem negativa: ${margemLiquidaPct.toFixed(1)}% (R$ ${margemLiquida.toFixed(2)})`,
    });
    breakdown.margemSaude = 0;
    breakdown.governanca = 0;
  } else if (margemLiquidaPct < params.margemMinima) {
    // Below minimum
    flags.push({
      severity: 'critica',
      code: 'PRICE_BELOW_MIN_MARGIN',
      message: `Margem ${margemLiquidaPct.toFixed(1)}% abaixo do mínimo ${params.margemMinima}%`,
    });
    breakdown.margemSaude = 10;
    breakdown.governanca = 0;
  } else if (margemLiquidaPct >= margemMeta) {
    // Above target
    breakdown.margemSaude = 40;
  } else {
    // Between min and target
    breakdown.margemSaude = 25;
  }

  // Price below floor
  if (params.precoVenda < precoMinimo) {
    flags.push({
      severity: 'critica',
      code: 'PRICE_BELOW_FLOOR',
      message: `Preço R$ ${params.precoVenda.toFixed(2)} abaixo do piso R$ ${precoMinimo.toFixed(2)}`,
    });
    breakdown.governanca = 0;
  }

  // === COMPETITIVIDADE (0-30) ===
  if (params.precoMedioMercado && params.precoMedioMercado > 0) {
    const indice = params.precoVenda / params.precoMedioMercado;

    if (indice >= 0.98 && indice <= 1.02) {
      breakdown.competitividade = 30; // Na média
    } else if ((indice >= 0.95 && indice < 0.98) || (indice > 1.02 && indice <= 1.06)) {
      breakdown.competitividade = 20; // Próximo
    } else if ((indice >= 0.90 && indice < 0.95) || (indice > 1.06 && indice <= 1.15)) {
      breakdown.competitividade = 10;
    } else if (indice < 0.90) {
      breakdown.competitividade = 5;
      flags.push({
        severity: 'alerta',
        code: 'PRICE_MUCH_BELOW_MARKET',
        message: `Preço ${((1 - indice) * 100).toFixed(0)}% abaixo da média de mercado`,
      });
    } else {
      breakdown.competitividade = 5;
      flags.push({
        severity: 'alerta',
        code: 'PRICE_MUCH_ABOVE_MARKET',
        message: `Preço ${((indice - 1) * 100).toFixed(0)}% acima da média de mercado`,
      });
    }
  } else {
    // No market data — neutral score
    breakdown.competitividade = 15;
  }

  // === SCORE ===
  const score = Math.max(0, Math.min(100,
    breakdown.margemSaude + breakdown.competitividade +
    breakdown.riscoOperacional + breakdown.governanca
  ));

  const hasCritical = flags.some((f) => f.severity === 'critica');
  const valid = !hasCritical;

  let status: PricingValidation['status'];
  if (score >= 85) status = 'otimo';
  else if (score >= 70) status = 'bom';
  else if (score >= 55) status = 'atencao';
  else status = 'critico';

  return {
    valid,
    score,
    status,
    flags,
    breakdown,
    guardrails: {
      precoMinimo,
      precoMaximo: params.precoMaximoMercado || null,
      margemLiquida,
      margemLiquidaPct,
    },
    precoArredondado,
  };
}
