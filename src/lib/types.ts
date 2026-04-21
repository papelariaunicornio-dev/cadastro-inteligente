// ==========================================
// NF-e XML parsed types
// ==========================================

export interface ParsedNF {
  chaveAcesso: string;
  numeroNf: string;
  dataEmissao: string;
  fornecedor: {
    cnpj: string;
    nome: string;
    fantasia: string;
  };
  destinatario: {
    cnpj: string;
    nome: string;
  };
  valorTotal: number;
}

export interface ParsedItem {
  nItem: number;
  codigo: string;
  ean: string | null;
  descricao: string;
  ncm: string;
  cfop: string;
  unidadeComercial: string;
  quantidade: number;
  unidadesPorItem: number;
  valorUnitario: number;
  valorProduto: number;
  valorIpi: number;
  valorTotal: number;
}

// ==========================================
// DB record types (NocoDB rows)
// ==========================================

export interface NfImport {
  Id: number;
  user_id: string;
  chave_acesso: string;
  numero_nf: string;
  data_emissao: string;
  fornecedor_cnpj: string;
  fornecedor_nome: string;
  fornecedor_fantasia: string;
  destinatario_cnpj: string;
  destinatario_nome: string;
  valor_total: number;
  xml_original: string;
  created_at: string;
}

export type ItemClassification = 'sem_variacao' | 'com_variacao' | 'multiplos_itens';

export interface NfItem {
  Id: number;
  nf_import_id: string;
  n_item: number;
  codigo: string;
  ean: string | null;
  descricao: string;
  ncm: string;
  cfop: string;
  unidade_comercial: string;
  quantidade: number;
  unidades_por_item: number;
  valor_unitario: number;
  valor_produto: number;
  valor_ipi: number;
  valor_total: number;
  classificacao: ItemClassification | null;
  grupo_id: string | null;
  selecionado: boolean;
  created_at: string;
}

export type JobStatus =
  | 'pendente'
  | 'pesquisando'
  | 'scraping'
  | 'buscando_imagens'
  | 'gerando'
  | 'concluido'
  | 'erro';

export interface ProcessingJob {
  Id: number;
  user_id: string;
  nf_import_id: string;
  tipo: ItemClassification;
  status: JobStatus;
  erro_mensagem: string | null;
  item_ids: string; // JSON array of NfItem Ids
  grupo_id: string | null;
  urls_encontradas: string | null; // JSON
  dados_scraping: string | null; // JSON
  prompt_enviado: string | null;
  resposta_ia: string | null; // JSON
  created_at: string;
  updated_at: string;
}

export type DraftStatus = 'aguardando' | 'aprovado' | 'enviado' | 'erro_envio' | 'descartado';

export interface ProductImage {
  url: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  source: string;
  origem: 'scrape' | 'searxng'; // Where the image came from
  selecionada: boolean;
  ordem: number;
}

export interface ProductVariation {
  nome: string;
  sku: string;
  ean: string;
  imagens: string[];
  atributos: Record<string, string>;
  preco?: number;
  estoque?: number;
}

export interface PriceFound {
  fonte: string;
  url: string;
  preco: number;
  data: string;
}

export interface PriceComposition {
  custo_unitario: number;
  custo_com_ipi: number;
  frete_estimado: number;
  impostos_venda: number;
  impostos_venda_pct: number;
  comissao: number;
  comissao_pct: number;
  margem: number;
  margem_pct: number;
  preco_final: number;
}

export interface ProductDraft {
  Id: number;
  job_id: string;
  user_id: string;
  status: DraftStatus;
  titulo: string;
  descricao_curta: string | null;
  descricao: string | null;
  marca: string | null;
  categoria: string | null;
  tags: string | null; // JSON array
  sku: string | null;
  ean: string | null;
  ncm: string | null;
  peso: number | null;
  altura: number | null;
  largura: number | null;
  profundidade: number | null;
  imagens: string | null; // JSON ProductImage[]
  custo_unitario: number | null;
  custo_com_ipi: number | null;
  preco_sugerido: number | null;
  preco_medio_ecommerce: number | null;
  preco_medio_marketplace: number | null;
  preco_final: number | null;
  precos_encontrados: string | null; // JSON PriceFound[]
  composicao_preco: string | null; // JSON PriceComposition
  tem_variacoes: boolean;
  tipo_variacao: string | null;
  variacoes: string | null; // JSON ProductVariation[]
  atributos: string | null; // JSON
  fontes: string | null; // JSON
  destino_envio: string | null; // JSON string[]
  resultado_envio: string | null; // JSON
  titulo_seo: string | null;
  descricao_seo: string | null;
  palavras_chave: string | null;
  estoque: number | null;
  fornecedor_nome: string | null;
  fornecedor_cnpj: string | null;
  codigo_fornecedor: string | null; // cProd da NF — codigo do produto no fornecedor
  openai_tokens: number | null;
  firecrawl_credits: number | null;
  enviado_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface UserSettings {
  Id: number;
  user_id: string;
  nome_loja: string | null;
  segmento: string | null;
  publico_alvo: string | null;
  tom_de_voz: string | null;
  diferenciais: string | null;
  regime_tributario: string;
  aliquota_impostos: number;
  margem_desejada: number;
  margens_por_categoria: string | null; // JSON
  comissao_ecommerce: number;
  comissao_ml: number;
  comissao_shopee: number;
  frete_medio_unidade: number;
  taxas_fixas: number;
  template_titulo: string | null;
  tamanho_max_titulo: number;
  instrucoes_descricao: string | null;
  incluir_specs: boolean;
  prefixo_sku: string;
  formato_sku: string | null;
  sequencia_sku: number;
  sites_concorrentes: string | null; // JSON array of {url, nome}
  tiny_token_encrypted: string | null;
  shopify_url: string | null;
  shopify_token_encrypted: string | null;
  shopify_location_id: string | null;
  nuvemshop_store_id: string | null;
  nuvemshop_token_encrypted: string | null;
  created_at: string;
  updated_at: string;
}

// ==========================================
// API response helpers
// ==========================================

export interface NfUploadResponse {
  nfImport: NfImport;
  items: NfItem[];
}

export interface UrlClassification {
  marca: string[];
  ecommerce: string[];
  marketplace: string[];
  concorrente: string[];
}

export interface ScrapedData {
  url: string;
  tipo: 'marca' | 'ecommerce' | 'marketplace' | 'concorrente';
  titulo?: string;
  descricao?: string;
  especificacoes?: Record<string, string>;
  preco?: number;
  imagens?: string[];
}
