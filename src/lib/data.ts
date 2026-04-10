/**
 * Server-side data fetching functions.
 * Used by Server Components — never imported in 'use client' files.
 * Keeps data fetching on the server, close to the DB.
 */

import { list, get } from './nocodb';
import { TABLES } from './nocodb-tables';
import type {
  NfImport,
  NfItem,
  ProcessingJob,
  ProductDraft,
  UserSettings,
} from './types';
import { computeItemTotal } from './schemas';

// ==========================================
// NF Imports
// ==========================================

export async function getRecentNfImports(limit = 10) {
  return list<NfImport>(TABLES.NF_IMPORTS, {
    sort: '-created_at',
    limit,
    fields: 'Id,numero_nf,fornecedor_nome,fornecedor_fantasia,valor_total,data_emissao,created_at',
  });
}

export async function getNfImport(id: string | number) {
  return get<NfImport>(TABLES.NF_IMPORTS, id);
}

export async function getNfItems(nfImportId: string | number) {
  const result = await list<NfItem>(TABLES.NF_ITEMS, {
    where: `(nf_import_id,eq,${nfImportId})`,
    sort: 'n_item',
    limit: 200,
  });

  // Compute valor_total in code, not stored in DB
  return result.list.map((item) => ({
    ...item,
    valor_total_computed: computeItemTotal(
      Number(item.valor_produto),
      Number(item.valor_ipi)
    ),
  }));
}

// ==========================================
// Product counts (for dashboard)
// ==========================================

export async function getProductCounts() {
  const [processing, aguardando, aprovados] = await Promise.all([
    list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,neq,concluido)~and(status,neq,erro)',
      limit: 1,
    }),
    list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where: '(status,eq,aguardando)',
      limit: 1,
    }),
    list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where: '(status,eq,aprovado)~or(status,eq,enviado)',
      limit: 1,
    }),
  ]);

  return {
    processando: processing.totalRows,
    aguardando: aguardando.totalRows,
    aprovados: aprovados.totalRows,
  };
}

// ==========================================
// Products
// ==========================================

export async function getProducts(status?: string, limit = 50) {
  const where = status ? `(status,eq,${status})` : undefined;
  return list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
    where,
    sort: '-created_at',
    limit,
  });
}

export async function getProduct(id: string | number) {
  return get<ProductDraft>(TABLES.PRODUCT_DRAFTS, id);
}

// ==========================================
// Settings
// ==========================================

export async function getUserSettings(): Promise<UserSettings | null> {
  const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
    where: '(user_id,eq,admin)',
    limit: 1,
  });
  return result.list[0] || null;
}
