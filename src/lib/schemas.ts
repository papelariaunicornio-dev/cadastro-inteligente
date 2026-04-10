/**
 * Zod schemas for business rule validation.
 * All validation happens here in the backend — not in DB constraints.
 */

import { z } from 'zod';

// ==========================================
// Enums
// ==========================================

export const ItemClassificationSchema = z.enum([
  'sem_variacao',
  'com_variacao',
  'multiplos_itens',
]);

export const JobStatusSchema = z.enum([
  'pendente',
  'pesquisando',
  'scraping',
  'buscando_imagens',
  'gerando',
  'concluido',
  'erro',
]);

export const DraftStatusSchema = z.enum([
  'aguardando',
  'aprovado',
  'enviado',
  'erro_envio',
  'descartado',
]);

export const RegimeTributarioSchema = z.enum([
  'simples_nacional',
  'lucro_presumido',
  'lucro_real',
]);

// ==========================================
// Settings validation
// ==========================================

export const UserSettingsUpdateSchema = z.object({
  nome_loja: z.string().max(100).nullable().optional(),
  segmento: z.string().max(100).nullable().optional(),
  publico_alvo: z.string().max(500).nullable().optional(),
  tom_de_voz: z.string().max(500).nullable().optional(),
  diferenciais: z.string().max(500).nullable().optional(),
  regime_tributario: RegimeTributarioSchema.optional(),
  aliquota_impostos: z.number().min(0).max(100).optional(),
  margem_desejada: z.number().min(0).max(100).optional(),
  comissao_ecommerce: z.number().min(0).max(100).optional(),
  comissao_ml: z.number().min(0).max(100).optional(),
  comissao_shopee: z.number().min(0).max(100).optional(),
  frete_medio_unidade: z.number().min(0).optional(),
  taxas_fixas: z.number().min(0).optional(),
  template_titulo: z.string().max(500).nullable().optional(),
  tamanho_max_titulo: z.number().int().min(10).max(500).optional(),
  instrucoes_descricao: z.string().max(2000).nullable().optional(),
  prefixo_sku: z.string().max(10).optional(),
  formato_sku: z.string().max(100).nullable().optional(),
});

// ==========================================
// Selection validation
// ==========================================

export const SelectionItemSchema = z.object({
  itemId: z.number().int().positive(),
  classificacao: ItemClassificationSchema,
  grupoId: z.string().nullable(),
});

export const SelectionRequestSchema = z.object({
  selections: z.array(SelectionItemSchema).min(1),
});

// ==========================================
// Job creation validation
// ==========================================

export const JobRequestSchema = z.object({
  nfImportId: z.string().min(1),
  jobs: z.array(
    z.object({
      tipo: ItemClassificationSchema,
      itemIds: z.array(z.number().int().positive()).min(1),
      grupoId: z.string().nullable(),
    })
  ).min(1),
});

// ==========================================
// Product update validation
// ==========================================

export const ProductUpdateSchema = z.object({
  titulo: z.string().max(200).optional(),
  descricao_curta: z.string().max(500).nullable().optional(),
  descricao: z.string().nullable().optional(),
  marca: z.string().max(100).nullable().optional(),
  categoria: z.string().max(100).nullable().optional(),
  sku: z.string().max(50).nullable().optional(),
  preco_final: z.number().min(0).optional(),
  titulo_seo: z.string().max(70).nullable().optional(),
  descricao_seo: z.string().max(160).nullable().optional(),
  palavras_chave: z.string().max(500).nullable().optional(),
  imagens: z.string().nullable().optional(), // JSON string
  variacoes: z.string().nullable().optional(), // JSON string
  tipo_variacao: z.string().max(50).nullable().optional(),
  tem_variacoes: z.boolean().optional(),
  destino_envio: z.string().nullable().optional(), // JSON string
  status: DraftStatusSchema.optional(),
});

// ==========================================
// AI response validation
// ==========================================

export const AIProductResponseSchema = z.object({
  titulo: z.string(),
  descricao_curta: z.string(),
  descricao: z.string(),
  marca: z.string(),
  categoria: z.string(),
  tags: z.array(z.string()),
  sku_sugerido: z.string(),
  peso_estimado: z.number().nullable(),
  dimensoes: z.object({
    altura: z.number().nullable(),
    largura: z.number().nullable(),
    profundidade: z.number().nullable(),
  }),
  atributos: z.record(z.string(), z.string()),
  tem_variacoes: z.boolean(),
  tipo_variacao: z.string().nullable(),
  variacoes: z.array(
    z.object({
      nome: z.string(),
      atributos: z.record(z.string(), z.string()),
    })
  ),
});

// ==========================================
// Computed values (business rules in code, not DB)
// ==========================================

export function computeItemTotal(valorProduto: number, valorIpi: number): number {
  return Math.round((valorProduto + valorIpi) * 100) / 100;
}

export function computeUnitCost(
  valorProduto: number,
  valorIpi: number,
  quantidade: number,
  unidadesPorItem: number
): { custoUnitario: number; custoComIpi: number } {
  const und = unidadesPorItem || 1;
  const qtd = quantidade || 1;
  return {
    custoUnitario: Math.round((valorProduto / (qtd * und)) * 100) / 100,
    custoComIpi: Math.round(((valorProduto + valorIpi) / (qtd * und)) * 100) / 100,
  };
}
