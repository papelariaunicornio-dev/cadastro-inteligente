/**
 * SKU Rules Engine
 *
 * Validates, generates, and scores SKU codes.
 * Hard rules: no spaces, no special chars (except - _), max 32 chars,
 * no duplicates, immutable after publish, flag O/0 and I/1 ambiguity.
 */

// ==========================================
// Types
// ==========================================

export interface SkuValidation {
  valid: boolean;
  score: number; // 0-100
  status: 'otimo' | 'bom' | 'atencao' | 'critico';
  flags: SkuFlag[];
  breakdown: {
    compliance: number;     // 0-50
    legibilidade: number;   // 0-20
    padronizacao: number;   // 0-20
    operacional: number;    // 0-10
  };
}

export interface SkuFlag {
  severity: 'critica' | 'alta' | 'media' | 'baixa';
  code: string;
  message: string;
}

export interface SkuTemplate {
  id: number;
  name: string;
  pattern: string;
  example: string;
}

// ==========================================
// Templates
// ==========================================

export const SKU_TEMPLATES: SkuTemplate[] = [
  { id: 1, name: 'Sequencial simples', pattern: 'SKU-{seq}', example: 'SKU-00142' },
  { id: 2, name: 'Marca + sequencial', pattern: '{marca3}-{seq}', example: 'PEN-001' },
  { id: 3, name: 'Categoria + marca + sequencial', pattern: '{cat}-{marca3}-{seq}', example: 'CAN-PEN-001' },
  { id: 4, name: 'Prefixo + marca + modelo', pattern: '{prefixo}-{marca3}-{modelo}', example: 'PU-PEN-ENRGL' },
  { id: 5, name: 'Categoria + cor + tamanho', pattern: '{cat}-{cor}-{tam}', example: 'CAM-PRE-G' },
  { id: 6, name: 'Operação escala', pattern: '{cat}{seq6}', example: 'CAN000142' },
  { id: 7, name: 'Marketplace', pattern: '{marca3}-{cat}-{seq}', example: 'NIK-CAL-001' },
  { id: 8, name: 'Keyword SEO', pattern: '{cat}-{keyword3}-{var}', example: 'CAN-ESF-AZ' },
];

// ==========================================
// Hard Rules Validation
// ==========================================

const VALID_SKU_REGEX = /^[A-Za-z0-9_-]+$/;
const MAX_SKU_LENGTH = 32;
const IDEAL_MIN_LENGTH = 8;
const IDEAL_MAX_LENGTH = 12;
const AMBIGUOUS_PAIRS = [
  { chars: ['O', '0'], near: true },
  { chars: ['I', '1', 'l'], near: true },
];

export function validateSku(
  sku: string,
  existingSkus: string[] = []
): SkuValidation {
  const flags: SkuFlag[] = [];
  const breakdown = {
    compliance: 50,
    legibilidade: 20,
    padronizacao: 0,
    operacional: 0,
  };

  // === COMPLIANCE (0-50) ===

  // Has spaces
  if (/\s/.test(sku)) {
    flags.push({
      severity: 'critica',
      code: 'SKU_HAS_SPACES',
      message: 'SKU não pode conter espaços',
    });
    breakdown.compliance = 0;
  }

  // Invalid characters
  if (!VALID_SKU_REGEX.test(sku) && !/\s/.test(sku)) {
    flags.push({
      severity: 'critica',
      code: 'SKU_INVALID_CHARS',
      message: 'SKU contém caracteres inválidos (permitido: letras, números, - e _)',
    });
    breakdown.compliance = Math.max(breakdown.compliance - 30, 0);
  }

  // Too long
  if (sku.length > MAX_SKU_LENGTH) {
    flags.push({
      severity: 'alta',
      code: 'SKU_TOO_LONG',
      message: `SKU tem ${sku.length} caracteres (máximo: ${MAX_SKU_LENGTH})`,
    });
    breakdown.compliance = Math.max(breakdown.compliance - 20, 0);
  }

  // Empty
  if (sku.trim().length === 0) {
    flags.push({
      severity: 'critica',
      code: 'SKU_EMPTY',
      message: 'SKU está vazio',
    });
    breakdown.compliance = 0;
  }

  // Duplicate
  if (existingSkus.includes(sku.toUpperCase())) {
    flags.push({
      severity: 'critica',
      code: 'SKU_DUPLICATE',
      message: 'Este SKU já existe no catálogo',
    });
    breakdown.compliance = Math.max(breakdown.compliance - 25, 0);
  }

  // === LEGIBILIDADE (0-20) ===

  // Uses separators (hyphens/underscores)
  if (/[-_]/.test(sku)) {
    // Good — has separators
  } else {
    breakdown.legibilidade = Math.max(breakdown.legibilidade - 10, 0);
  }

  // Ideal length
  if (sku.length < IDEAL_MIN_LENGTH || sku.length > IDEAL_MAX_LENGTH) {
    breakdown.legibilidade = Math.max(breakdown.legibilidade - 10, 0);
    if (sku.length < 3) {
      flags.push({
        severity: 'media',
        code: 'SKU_TOO_SHORT',
        message: 'SKU muito curto (recomendado: 8-12 caracteres)',
      });
    }
  }

  // Ambiguity check (O/0, I/1/l)
  for (const pair of AMBIGUOUS_PAIRS) {
    const found = pair.chars.filter((c) => sku.includes(c));
    if (found.length >= 2) {
      flags.push({
        severity: 'baixa',
        code: 'SKU_AMBIGUOUS',
        message: `SKU contém caracteres ambíguos próximos: ${found.join(', ')}`,
      });
    }
  }

  // === PADRONIZAÇÃO (0-20) ===
  // Check if follows any known template pattern
  const hasCategory = /^[A-Z]{2,4}[-_]/.test(sku.toUpperCase());
  const hasBrand = /[-_][A-Z]{2,4}[-_]/.test(sku.toUpperCase());
  if (hasCategory) breakdown.padronizacao += 10;
  if (hasBrand) breakdown.padronizacao += 10;

  // === OPERACIONAL (0-10) ===
  const upperSku = sku.toUpperCase();
  if (/^[A-Z]{2,4}[-_]/.test(upperSku)) breakdown.operacional += 5; // Has category prefix
  if (/[-_][A-Z]{2,4}[-_]/.test(upperSku) || /[-_][A-Z]{2,4}$/.test(upperSku)) {
    breakdown.operacional += 5; // Has brand abbreviation
  }

  // === SCORE ===
  const score = Math.max(
    0,
    Math.min(100, breakdown.compliance + breakdown.legibilidade + breakdown.padronizacao + breakdown.operacional)
  );

  const hasCritical = flags.some((f) => f.severity === 'critica');
  const valid = !hasCritical;

  let status: SkuValidation['status'];
  if (score >= 85) status = 'otimo';
  else if (score >= 70) status = 'bom';
  else if (score >= 55) status = 'atencao';
  else status = 'critico';

  return { valid, score, status, flags, breakdown };
}

// ==========================================
// SKU Generation
// ==========================================

export function generateSku(params: {
  prefixo?: string;
  marca?: string;
  categoria?: string;
  modelo?: string;
  variacao?: string;
  sequencia?: number;
}): string {
  const { prefixo, marca, categoria, modelo, variacao, sequencia = 1 } = params;

  const marca3 = (marca || 'GEN')
    .replace(/[^A-Za-z]/g, '')
    .substring(0, 3)
    .toUpperCase();

  const cat = (categoria || '')
    .replace(/[^A-Za-z]/g, '')
    .substring(0, 3)
    .toUpperCase();

  const mod = (modelo || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .substring(0, 5)
    .toUpperCase();

  const varShort = (variacao || '')
    .replace(/[^A-Za-z0-9]/g, '')
    .substring(0, 4)
    .toUpperCase();

  const seq = String(sequencia).padStart(3, '0');

  const parts: string[] = [];
  if (prefixo) parts.push(prefixo.toUpperCase());
  if (cat) parts.push(cat);
  if (marca3) parts.push(marca3);
  if (mod) parts.push(mod);
  else parts.push(seq);

  let sku = parts.join('-');

  if (variacao && varShort) {
    sku += `-${varShort}`;
  }

  // Ensure max length
  if (sku.length > MAX_SKU_LENGTH) {
    sku = sku.substring(0, MAX_SKU_LENGTH);
  }

  return sku;
}
