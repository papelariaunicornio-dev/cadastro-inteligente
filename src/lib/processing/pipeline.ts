/**
 * Main processing pipeline orchestrator.
 * Runs each job through: search → scrape → images → generate → price → save draft.
 * Each step has a timeout to prevent hanging.
 */

import { get, update, create, list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';

const STEP_TIMEOUT_MS = 120_000; // 2 minutes per step

/**
 * Wrap an async operation with a timeout.
 */
async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${ms / 1000}s`)), ms)
    ),
  ]);
}
import type {
  ProcessingJob,
  NfItem,
  NfImport,
  ProductDraft,
  UserSettings,
  JobStatus,
  ScrapedData,
  PriceFound,
} from '@/lib/types';
import { searchProduct } from './search';
import { scrapePages } from './scraper';
import { collectImages } from './images';
import { generateProductDraft } from './generate';
import {
  calculateUnitCost,
  calculateSuggestedPrice,
  calculateAveragePrices,
} from './price-engine';

/**
 * Update job status in NocoDB.
 */
async function setJobStatus(
  jobId: number,
  status: JobStatus,
  extra?: Partial<ProcessingJob>
): Promise<void> {
  await update(TABLES.PROCESSING_JOBS, jobId, {
    status,
    updated_at: new Date().toISOString(),
    ...extra,
  });
}

/**
 * Load user settings (or defaults).
 */
async function loadSettings(): Promise<Partial<UserSettings> | null> {
  try {
    const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
      where: '(user_id,eq,admin)',
      limit: 1,
    });
    return result.list[0] || null;
  } catch {
    return null;
  }
}

/**
 * Process a single job end-to-end.
 */
export async function processJob(jobId: number): Promise<void> {
  console.log(`[Pipeline] Starting job ${jobId}`);

  try {
    // Load job
    const job = await get<ProcessingJob>(TABLES.PROCESSING_JOBS, jobId);

    // Load NF import
    const nfImport = await get<NfImport>(
      TABLES.NF_IMPORTS,
      job.nf_import_id
    );

    // Load items
    const itemIds: number[] = JSON.parse(job.item_ids);
    const allItems = await list<NfItem>(TABLES.NF_ITEMS, {
      where: `(nf_import_id,eq,${job.nf_import_id})`,
      limit: 200,
    });
    const items = allItems.list.filter((item) => itemIds.includes(item.Id));

    if (items.length === 0) {
      await setJobStatus(jobId, 'erro', {
        erro_mensagem: 'Nenhum item encontrado para este job',
      });
      return;
    }

    // Load settings
    const settings = await loadSettings();

    // ========== Step 1: SEARCH ==========
    await setJobStatus(jobId, 'pesquisando');
    console.log(`[Pipeline] Job ${jobId}: searching...`);

    const searchResult = await withTimeout(
      searchProduct({
        items,
        fornecedorCnpj: nfImport.fornecedor_cnpj,
        fornecedorNome: nfImport.fornecedor_nome,
        fornecedorFantasia: nfImport.fornecedor_fantasia,
      }),
      STEP_TIMEOUT_MS,
      'search'
    );

    await setJobStatus(jobId, 'pesquisando', {
      urls_encontradas: JSON.stringify(searchResult.classified),
    });

    // ========== Step 2: SCRAPE ==========
    await setJobStatus(jobId, 'scraping');
    console.log(`[Pipeline] Job ${jobId}: scraping ${searchResult.allUrls.length} URLs...`);

    const scrapedData = await withTimeout(
      scrapePages(searchResult.classified),
      STEP_TIMEOUT_MS,
      'scrape'
    );

    await setJobStatus(jobId, 'scraping', {
      dados_scraping: JSON.stringify(
        scrapedData.map((d) => ({
          url: d.url,
          tipo: d.tipo,
          titulo: d.titulo,
          preco: d.preco,
          hasDescription: !!d.descricao,
          imageCount: d.imagens?.length || 0,
        }))
      ),
    });

    // ========== Step 3: IMAGES ==========
    await setJobStatus(jobId, 'buscando_imagens');
    console.log(`[Pipeline] Job ${jobId}: collecting images...`);

    const images = collectImages(scrapedData);

    // ========== Step 4: GENERATE ==========
    await setJobStatus(jobId, 'gerando');
    console.log(`[Pipeline] Job ${jobId}: generating with AI...`);

    const generated = await withTimeout(
      generateProductDraft({
        items,
        tipo: job.tipo as 'sem_variacao' | 'com_variacao' | 'multiplos_itens',
        brand: searchResult.brand,
        scrapedData,
        settings,
      }),
      STEP_TIMEOUT_MS,
      'generate'
    );

    // ========== Step 5: PRICE ==========
    const primaryItem = items[0];
    const { custoUnitario, custoComIpi } = calculateUnitCost(primaryItem);

    const priceComposition = calculateSuggestedPrice(custoComIpi, {
      aliquota_impostos: Number(settings?.aliquota_impostos) || 6,
      margem_desejada: Number(settings?.margem_desejada) || 40,
      comissao_ecommerce: Number(settings?.comissao_ecommerce) || 0,
      frete_medio_unidade: Number(settings?.frete_medio_unidade) || 0,
      taxas_fixas: Number(settings?.taxas_fixas) || 0,
    });

    const avgPrices = calculateAveragePrices(scrapedData);

    // Collect all found prices
    const precosEncontrados: PriceFound[] = scrapedData
      .filter((d) => d.preco)
      .map((d) => ({
        fonte: d.tipo,
        url: d.url,
        preco: d.preco!,
        data: new Date().toISOString(),
      }));

    // ========== Step 6: CREATE DRAFT ==========
    const now = new Date().toISOString();

    // Build variations for multiplos_itens
    let variacoes = generated.variacoes || [];
    if (job.tipo === 'multiplos_itens' && items.length > 1) {
      // Override with actual items as variations
      variacoes = items.map((item) => ({
        nome: extractVariationName(item.descricao, items[0].descricao),
        sku: `${generated.sku_sugerido}-${item.codigo}`,
        ean: item.ean || '',
        atributos: {},
        imagens: [],
      }));
    }

    await create<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      job_id: String(jobId),
      user_id: 'admin',
      status: 'aguardando',
      titulo: generated.titulo,
      descricao_curta: generated.descricao_curta,
      descricao: generated.descricao,
      marca: generated.marca || searchResult.brand,
      categoria: generated.categoria,
      tags: JSON.stringify(generated.tags),
      sku: generated.sku_sugerido,
      ean: primaryItem.ean,
      ncm: primaryItem.ncm,
      peso: generated.peso_estimado,
      altura: generated.dimensoes?.altura,
      largura: generated.dimensoes?.largura,
      profundidade: generated.dimensoes?.profundidade,
      imagens: JSON.stringify(images),
      custo_unitario: custoUnitario,
      custo_com_ipi: custoComIpi,
      preco_sugerido: priceComposition.preco_final,
      preco_medio_ecommerce: avgPrices.ecommerce,
      preco_medio_marketplace: avgPrices.marketplace,
      preco_final: priceComposition.preco_final,
      precos_encontrados: JSON.stringify(precosEncontrados),
      composicao_preco: JSON.stringify(priceComposition),
      tem_variacoes: generated.tem_variacoes || variacoes.length > 0,
      tipo_variacao: generated.tipo_variacao,
      variacoes: JSON.stringify(variacoes),
      atributos: JSON.stringify(generated.atributos),
      fontes: JSON.stringify(
        scrapedData.map((d) => ({
          tipo: d.tipo,
          url: d.url,
          titulo: d.titulo,
        }))
      ),
      created_at: now,
      updated_at: now,
    });

    // ========== DONE ==========
    await setJobStatus(jobId, 'concluido');
    console.log(`[Pipeline] Job ${jobId}: completed successfully`);
  } catch (error) {
    console.error(`[Pipeline] Job ${jobId} failed:`, error);
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    await setJobStatus(jobId, 'erro', {
      erro_mensagem: message,
    });
  }
}

/**
 * Process all pending jobs for a given NF import.
 */
export async function processAllPendingJobs(nfImportId: string): Promise<void> {
  const result = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
    where: `(nf_import_id,eq,${nfImportId})~and(status,eq,pendente)`,
    limit: 100,
  });

  console.log(`[Pipeline] Found ${result.list.length} pending jobs for NF ${nfImportId}`);

  // Process sequentially to respect API rate limits
  for (const job of result.list) {
    await processJob(job.Id);
  }
}

/**
 * Extract variation name by finding the difference between two descriptions.
 * e.g., "CANETA ENERGEL 0.5MM AZUL" vs "CANETA ENERGEL 0.5MM" -> "AZUL"
 */
function extractVariationName(
  itemDesc: string,
  baseDesc: string
): string {
  const itemWords = itemDesc.toUpperCase().split(/\s+/);
  const baseWords = baseDesc.toUpperCase().split(/\s+/);

  const diff = itemWords.filter((w) => !baseWords.includes(w));
  if (diff.length > 0) {
    return diff
      .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }

  // Fallback: use last word
  return itemWords[itemWords.length - 1] || 'Variação';
}
