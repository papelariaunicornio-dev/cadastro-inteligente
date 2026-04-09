/**
 * One-time setup script to create NocoDB base and tables.
 * Run: npx tsx src/lib/nocodb-setup.ts
 *
 * After running, copy the BASE_ID and TABLE_IDs into:
 * - .env (NOCODB_BASE_ID)
 * - src/lib/nocodb-tables.ts (TABLES object)
 */

import 'dotenv/config';

const API_URL = process.env.NOCODB_API_URL;
const TOKEN = process.env.NOCODB_API_TOKEN;

if (!API_URL || !TOKEN) {
  throw new Error('Set NOCODB_API_URL and NOCODB_API_TOKEN in .env');
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const url = `${API_URL}/api/v2${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'xc-token': TOKEN!,
      ...options.headers,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status} on ${path}: ${text}`);
  }

  return res.json() as Promise<T>;
}

interface Base {
  id: string;
  title: string;
}

interface Table {
  id: string;
  title: string;
}

interface Column {
  id: string;
  title: string;
}

// ==========================================
// Table definitions
// ==========================================

interface ColumnDef {
  title: string;
  uidt: string;
  dt?: string;
  dtxp?: string;
  cdf?: string; // default value
  rqd?: boolean; // required
  un?: boolean; // unique
}

const TABLE_DEFINITIONS: { name: string; columns: ColumnDef[] }[] = [
  {
    name: 'nf_imports',
    columns: [
      { title: 'user_id', uidt: 'SingleLineText', rqd: true },
      { title: 'chave_acesso', uidt: 'SingleLineText', rqd: true },
      { title: 'numero_nf', uidt: 'SingleLineText', rqd: true },
      { title: 'data_emissao', uidt: 'SingleLineText' },
      { title: 'fornecedor_cnpj', uidt: 'SingleLineText', rqd: true },
      { title: 'fornecedor_nome', uidt: 'SingleLineText', rqd: true },
      { title: 'fornecedor_fantasia', uidt: 'SingleLineText' },
      { title: 'destinatario_cnpj', uidt: 'SingleLineText', rqd: true },
      { title: 'destinatario_nome', uidt: 'SingleLineText', rqd: true },
      { title: 'valor_total', uidt: 'Decimal' },
      { title: 'xml_original', uidt: 'LongText' },
      { title: 'created_at', uidt: 'SingleLineText' },
    ],
  },
  {
    name: 'nf_items',
    columns: [
      { title: 'nf_import_id', uidt: 'SingleLineText', rqd: true },
      { title: 'n_item', uidt: 'Number', rqd: true },
      { title: 'codigo', uidt: 'SingleLineText', rqd: true },
      { title: 'ean', uidt: 'SingleLineText' },
      { title: 'descricao', uidt: 'SingleLineText', rqd: true },
      { title: 'ncm', uidt: 'SingleLineText', rqd: true },
      { title: 'cfop', uidt: 'SingleLineText' },
      { title: 'unidade_comercial', uidt: 'SingleLineText', rqd: true },
      { title: 'quantidade', uidt: 'Decimal' },
      { title: 'unidades_por_item', uidt: 'Number', cdf: '1' },
      { title: 'valor_unitario', uidt: 'Decimal' },
      { title: 'valor_produto', uidt: 'Decimal' },
      { title: 'valor_ipi', uidt: 'Decimal', cdf: '0' },
      { title: 'valor_total', uidt: 'Decimal' },
      { title: 'classificacao', uidt: 'SingleLineText' },
      { title: 'grupo_id', uidt: 'SingleLineText' },
      { title: 'selecionado', uidt: 'Checkbox' },
      { title: 'created_at', uidt: 'SingleLineText' },
    ],
  },
  {
    name: 'processing_jobs',
    columns: [
      { title: 'user_id', uidt: 'SingleLineText', rqd: true },
      { title: 'nf_import_id', uidt: 'SingleLineText', rqd: true },
      { title: 'tipo', uidt: 'SingleLineText', rqd: true },
      { title: 'status', uidt: 'SingleLineText', cdf: 'pendente' },
      { title: 'erro_mensagem', uidt: 'LongText' },
      { title: 'item_ids', uidt: 'LongText', rqd: true },
      { title: 'grupo_id', uidt: 'SingleLineText' },
      { title: 'urls_encontradas', uidt: 'LongText' },
      { title: 'dados_scraping', uidt: 'LongText' },
      { title: 'prompt_enviado', uidt: 'LongText' },
      { title: 'resposta_ia', uidt: 'LongText' },
      { title: 'created_at', uidt: 'SingleLineText' },
      { title: 'updated_at', uidt: 'SingleLineText' },
    ],
  },
  {
    name: 'product_drafts',
    columns: [
      { title: 'job_id', uidt: 'SingleLineText' },
      { title: 'user_id', uidt: 'SingleLineText', rqd: true },
      { title: 'status', uidt: 'SingleLineText', cdf: 'aguardando' },
      { title: 'titulo', uidt: 'SingleLineText', rqd: true },
      { title: 'descricao_curta', uidt: 'LongText' },
      { title: 'descricao', uidt: 'LongText' },
      { title: 'marca', uidt: 'SingleLineText' },
      { title: 'categoria', uidt: 'SingleLineText' },
      { title: 'tags', uidt: 'LongText' },
      { title: 'sku', uidt: 'SingleLineText' },
      { title: 'ean', uidt: 'SingleLineText' },
      { title: 'ncm', uidt: 'SingleLineText' },
      { title: 'peso', uidt: 'Decimal' },
      { title: 'altura', uidt: 'Decimal' },
      { title: 'largura', uidt: 'Decimal' },
      { title: 'profundidade', uidt: 'Decimal' },
      { title: 'imagens', uidt: 'LongText' },
      { title: 'custo_unitario', uidt: 'Decimal' },
      { title: 'custo_com_ipi', uidt: 'Decimal' },
      { title: 'preco_sugerido', uidt: 'Decimal' },
      { title: 'preco_medio_ecommerce', uidt: 'Decimal' },
      { title: 'preco_medio_marketplace', uidt: 'Decimal' },
      { title: 'preco_final', uidt: 'Decimal' },
      { title: 'precos_encontrados', uidt: 'LongText' },
      { title: 'composicao_preco', uidt: 'LongText' },
      { title: 'tem_variacoes', uidt: 'Checkbox' },
      { title: 'tipo_variacao', uidt: 'SingleLineText' },
      { title: 'variacoes', uidt: 'LongText' },
      { title: 'atributos', uidt: 'LongText' },
      { title: 'fontes', uidt: 'LongText' },
      { title: 'destino_envio', uidt: 'LongText' },
      { title: 'resultado_envio', uidt: 'LongText' },
      { title: 'enviado_at', uidt: 'SingleLineText' },
      { title: 'created_at', uidt: 'SingleLineText' },
      { title: 'updated_at', uidt: 'SingleLineText' },
    ],
  },
  {
    name: 'user_settings',
    columns: [
      { title: 'user_id', uidt: 'SingleLineText', rqd: true },
      { title: 'nome_loja', uidt: 'SingleLineText' },
      { title: 'segmento', uidt: 'SingleLineText' },
      { title: 'publico_alvo', uidt: 'LongText' },
      { title: 'tom_de_voz', uidt: 'LongText' },
      { title: 'diferenciais', uidt: 'LongText' },
      { title: 'regime_tributario', uidt: 'SingleLineText', cdf: 'simples_nacional' },
      { title: 'aliquota_impostos', uidt: 'Decimal', cdf: '6' },
      { title: 'margem_desejada', uidt: 'Decimal', cdf: '40' },
      { title: 'margens_por_categoria', uidt: 'LongText' },
      { title: 'comissao_ecommerce', uidt: 'Decimal', cdf: '0' },
      { title: 'comissao_ml', uidt: 'Decimal', cdf: '16' },
      { title: 'comissao_shopee', uidt: 'Decimal', cdf: '20' },
      { title: 'frete_medio_unidade', uidt: 'Decimal', cdf: '0' },
      { title: 'taxas_fixas', uidt: 'Decimal', cdf: '0' },
      { title: 'template_titulo', uidt: 'LongText' },
      { title: 'tamanho_max_titulo', uidt: 'Number', cdf: '150' },
      { title: 'instrucoes_descricao', uidt: 'LongText' },
      { title: 'incluir_specs', uidt: 'Checkbox' },
      { title: 'prefixo_sku', uidt: 'SingleLineText' },
      { title: 'formato_sku', uidt: 'SingleLineText' },
      { title: 'sequencia_sku', uidt: 'Number', cdf: '1' },
      { title: 'tiny_token_encrypted', uidt: 'LongText' },
      { title: 'shopify_url', uidt: 'SingleLineText' },
      { title: 'shopify_token_encrypted', uidt: 'LongText' },
      { title: 'shopify_location_id', uidt: 'SingleLineText' },
      { title: 'created_at', uidt: 'SingleLineText' },
      { title: 'updated_at', uidt: 'SingleLineText' },
    ],
  },
];

// ==========================================
// Main setup
// ==========================================

async function main() {
  console.log('🚀 Setting up NocoDB for Cadastro Inteligente...\n');

  // Step 1: Create a new base
  console.log('📦 Creating base...');
  const base = await apiRequest<Base>('/meta/bases/', {
    method: 'POST',
    body: JSON.stringify({
      title: 'Cadastro Inteligente',
      type: 'database',
    }),
  });
  console.log(`   Base created: ${base.title} (ID: ${base.id})\n`);

  // Step 2: Create tables
  const tableIds: Record<string, string> = {};

  for (const tableDef of TABLE_DEFINITIONS) {
    console.log(`📋 Creating table: ${tableDef.name}...`);

    const table = await apiRequest<Table>(
      `/meta/bases/${base.id}/tables`,
      {
        method: 'POST',
        body: JSON.stringify({
          title: tableDef.name,
          columns: [
            // NocoDB auto-creates an 'Id' column as primary key
            ...tableDef.columns.map((col) => ({
              title: col.title,
              uidt: col.uidt,
              dt: col.dt,
              dtxp: col.dtxp,
              cdf: col.cdf,
              rqd: col.rqd,
              un: col.un,
            })),
          ],
        }),
      }
    );

    tableIds[tableDef.name] = table.id;
    console.log(`   ✅ ${tableDef.name} → ${table.id}`);
  }

  // Step 3: Print results
  console.log('\n' + '='.repeat(60));
  console.log('✅ SETUP COMPLETE!\n');

  console.log('1. Update .env:');
  console.log(`   NOCODB_BASE_ID=${base.id}\n`);

  console.log('2. Update src/lib/nocodb-tables.ts:');
  console.log('export const TABLES = {');
  console.log(`  NF_IMPORTS: '${tableIds.nf_imports}',`);
  console.log(`  NF_ITEMS: '${tableIds.nf_items}',`);
  console.log(`  PROCESSING_JOBS: '${tableIds.processing_jobs}',`);
  console.log(`  PRODUCT_DRAFTS: '${tableIds.product_drafts}',`);
  console.log(`  USER_SETTINGS: '${tableIds.user_settings}',`);
  console.log('} as const;');
  console.log('='.repeat(60));
}

main().catch((err) => {
  console.error('❌ Setup failed:', err.message);
  process.exit(1);
});
