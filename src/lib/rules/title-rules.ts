/**
 * Title Rules Engine
 *
 * Validates, scores, and enforces title quality rules.
 * Hard rules: no emojis, no promo terms, no ALL CAPS, no brand repetition,
 * no generic words. Score 0-100 with 4 blocks.
 */

// ==========================================
// Types
// ==========================================

export interface TitleValidation {
  valid: boolean;
  score: number;
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  flags: TitleFlag[];
  breakdown: {
    compliance: number;      // 0-40
    caracteres: number;      // 0-20
    seoPlacement: number;    // 0-25
    estrutura: number;       // 0-15
  };
  suggestions: string[];
}

export interface TitleFlag {
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  code: string;
  message: string;
}

export interface TitleTemplate {
  id: number;
  name: string;
  pattern: string;
  example: string;
  useCase: string;
}

export type Channel = 'mercadolivre' | 'shopee' | 'amazon' | 'magalu' | 'ecommerce';

// ==========================================
// Templates
// ==========================================

export const TITLE_TEMPLATES: TitleTemplate[] = [
  { id: 1, name: 'Padrão', pattern: '{nome} {marca} {cor_tamanho}', example: 'Caneta Esferográfica Pentel Energel Azul', useCase: 'Uso geral' },
  { id: 2, name: 'Com categoria', pattern: '{categoria} {nome} {marca} {cor_tamanho}', example: 'Caneta Gel Pentel Energel 0.5mm Azul', useCase: 'SEO por categoria' },
  { id: 3, name: 'SEO-first', pattern: '{keyword} {nome} {marca} {atributo}', example: 'Caneta Gel Ponta Fina Pentel Energel 0.5mm', useCase: 'Ranqueamento orgânico' },
  { id: 4, name: 'Variação', pattern: '{nome} {marca} - {variacao}: {valor}', example: 'Caneta Energel Pentel - Cor: Azul Petróleo', useCase: 'SKUs com variações' },
  { id: 5, name: 'Técnico', pattern: '{nome} {marca} {especificacao}', example: 'Caneta Esferográfica CIS Spiro 0.7mm Ponta Média', useCase: 'Produtos técnicos' },
  { id: 6, name: 'Marketplace', pattern: '{nome} {marca} {modelo} {atributo}', example: 'Caneta Pentel Energel X BLN105 0.5mm Retrátil', useCase: 'Marketplaces' },
  { id: 7, name: 'Benefício', pattern: '{nome} {marca} - {beneficio}', example: 'Caneta Energel Pentel - Escrita Ultra Suave', useCase: 'Conversão' },
  { id: 8, name: 'Público-alvo', pattern: '{nome} {marca} para {publico}', example: 'Kit Canetas CIS para Estudantes', useCase: 'Segmentação' },
  { id: 9, name: 'Compacto (mobile)', pattern: '{nome_curto} {marca} {variacao}', example: 'Energel Pentel Azul', useCase: 'Mobile-first' },
];

// ==========================================
// Constants
// ==========================================

const CHANNEL_LIMITS: Record<Channel, number> = {
  mercadolivre: 60,
  shopee: 60,
  amazon: 180,
  magalu: 150,
  ecommerce: 120,
};

const EMOJI_REGEX = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}]/gu;

const PROMO_TERMS = [
  'frete grátis', 'frete gratis', 'promoção', 'promocao', 'imperdível', 'imperdivel',
  'oferta', 'desconto', 'liquidação', 'liquidacao', 'queima', 'black friday',
  'super oferta', 'mega oferta', 'preço baixo', 'preco baixo',
];

const GENERIC_WORDS = [
  'top', 'lindo', 'barato', 'melhor', 'incrível', 'incrivel', 'maravilhoso',
  'perfeito', 'excelente', 'fantástico', 'fantastico', 'sensacional',
];

// ==========================================
// Validation
// ==========================================

export function validateTitle(
  title: string,
  options: {
    channel?: Channel;
    keyword?: string;
    marca?: string;
  } = {}
): TitleValidation {
  const { channel = 'ecommerce', keyword, marca } = options;
  const flags: TitleFlag[] = [];
  const suggestions: string[] = [];
  const breakdown = {
    compliance: 40,
    caracteres: 20,
    seoPlacement: 0,
    estrutura: 0,
  };

  const titleLower = title.toLowerCase();
  const titleNorm = titleLower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

  // === COMPLIANCE HARD RULES (0-40) ===

  // Emojis
  if (EMOJI_REGEX.test(title)) {
    flags.push({ severity: 'critica', code: 'TITLE_HAS_EMOJI', message: 'Título contém emojis' });
    breakdown.compliance -= 15;
    suggestions.push('Remova todos os emojis do título');
  }

  // Promo terms
  for (const term of PROMO_TERMS) {
    if (titleNorm.includes(term.normalize('NFD').replace(/[\u0300-\u036f]/g, ''))) {
      flags.push({ severity: 'critica', code: 'TITLE_PROMO_TERM', message: `Termo promocional proibido: "${term}"` });
      breakdown.compliance -= 12;
      suggestions.push(`Remova "${term}" do título`);
      break; // Only flag once
    }
  }

  // ALL CAPS (more than 60% uppercase, min 5 chars)
  if (title.length >= 5) {
    const upperCount = (title.match(/[A-Z]/g) || []).length;
    const letterCount = (title.match(/[A-Za-z]/g) || []).length;
    if (letterCount > 0 && upperCount / letterCount > 0.6) {
      flags.push({ severity: 'critica', code: 'TITLE_ALL_CAPS', message: 'Título em CAIXA ALTA' });
      breakdown.compliance -= 10;
      suggestions.push('Use capitalização normal (primeira letra maiúscula)');
    }
  }

  // Brand repetition
  if (marca) {
    const marcaLower = marca.toLowerCase();
    const occurrences = titleLower.split(marcaLower).length - 1;
    if (occurrences > 1) {
      flags.push({ severity: 'alta', code: 'TITLE_BRAND_REPEAT', message: `Marca "${marca}" repetida ${occurrences}x no título` });
      breakdown.compliance -= 8;
      suggestions.push(`Remova a repetição da marca "${marca}"`);
    }
  }

  // Generic words
  for (const word of GENERIC_WORDS) {
    if (titleNorm.includes(word)) {
      flags.push({ severity: 'media', code: 'TITLE_GENERIC_WORD', message: `Palavra genérica: "${word}"` });
      breakdown.compliance -= 5;
      suggestions.push(`Substitua "${word}" por um atributo específico do produto`);
      break;
    }
  }

  breakdown.compliance = Math.max(0, breakdown.compliance);

  // === LIMITE DE CARACTERES (0-20) ===
  const maxLength = CHANNEL_LIMITS[channel] || 120;

  if (title.length <= maxLength) {
    // Within limit
    if (title.length < 20) {
      breakdown.caracteres = 5;
      flags.push({ severity: 'media', code: 'TITLE_TOO_SHORT', message: 'Título muito curto (menos de 20 caracteres)' });
    }
  } else {
    const excess = title.length - maxLength;
    breakdown.caracteres = Math.max(0, 20 - excess);
    flags.push({
      severity: 'alta',
      code: 'TITLE_TOO_LONG',
      message: `Título excede limite do canal ${channel} (${title.length}/${maxLength} chars)`,
    });
    suggestions.push(`Reduza o título para ${maxLength} caracteres para o canal ${channel}`);
  }

  // === SEO PLACEMENT (0-25) ===
  if (keyword) {
    const keywordLower = keyword.toLowerCase();
    const words = titleLower.split(/\s+/);
    const keywordWords = keywordLower.split(/\s+/);

    // Find position of keyword in title
    let keywordPosition = -1;
    for (let i = 0; i <= words.length - keywordWords.length; i++) {
      const slice = words.slice(i, i + keywordWords.length).join(' ');
      if (slice.includes(keywordLower)) {
        keywordPosition = i;
        break;
      }
    }

    if (keywordPosition === -1) {
      // Keyword not in title at all — try partial match
      if (titleLower.includes(keywordLower)) {
        breakdown.seoPlacement = 15;
      } else {
        breakdown.seoPlacement = 0;
        suggestions.push(`Inclua a keyword "${keyword}" no título`);
      }
    } else if (keywordPosition <= 2) {
      breakdown.seoPlacement = 25; // First 3 words
    } else if (keywordPosition <= 5) {
      breakdown.seoPlacement = 15; // Words 4-6
    } else {
      breakdown.seoPlacement = 5; // Later
      suggestions.push(`Mova a keyword "${keyword}" para o início do título`);
    }
  } else {
    // No keyword to check — give partial score
    breakdown.seoPlacement = 10;
  }

  // === ESTRUTURA (0-15) ===
  // Has product name + brand
  const hasSubstantialContent = title.split(/\s+/).length >= 3;
  if (hasSubstantialContent) breakdown.estrutura += 10;

  // Has variation/attribute
  if (/\d/.test(title) || title.includes('-') || title.includes('|')) {
    breakdown.estrutura += 5;
  }

  // === FINAL SCORE ===
  const score = Math.max(0, Math.min(100,
    breakdown.compliance + breakdown.caracteres + breakdown.seoPlacement + breakdown.estrutura
  ));

  const hasCritical = flags.some((f) => f.severity === 'critica');
  const valid = !hasCritical;

  let status: TitleValidation['status'];
  if (score >= 85) status = 'otimo';
  else if (score >= 70) status = 'bom';
  else if (score >= 55) status = 'atencao';
  else status = 'critico';

  return { valid, score, status, flags, breakdown, suggestions };
}
