/**
 * Processing pipeline.
 *
 * Architecture:
 * - BullMQ Job is the source of truth for status and intermediate data
 * - Progress updates go to job.progress (Redis), NOT to NocoDB
 * - NocoDB processing_jobs table is only updated at start (status=processando)
 *   and at end (status=concluido/erro) as an audit log
 * - The product_draft is the only business output saved to NocoDB
 */

import type { Job } from 'bullmq';
import { get, update, create, list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type {
  NfItem,
  NfImport,
  ProductDraft,
  UserSettings,
  ScrapedData,
  PriceFound,
} from '@/lib/types';
import type { JobInput, JobProgress } from '@/lib/queue';
import { searchProduct } from './search';
import { scrapePages } from './scraper';
import { collectImages } from './images';
import { generateProductDraft } from './generate';
import {
  calculateUnitCost,
  calculateSuggestedPrice,
  calculateAveragePrices,
} from './price-engine';
import { psychologicalRound } from '../rules/pricing-rules';
import { validateSku } from '../rules/sku-rules';
import { validateTitle } from '../rules/title-rules';

const STEP_TIMEOUT_MS = 120_000;

async function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Timeout: ${label} excedeu ${ms / 1000}s`)), ms)
    ),
  ]);
}

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
 * Process a job from BullMQ queue.
 * All intermediate state stored in job.progress (Redis).
 * NocoDB only gets the final product_draft + audit log update.
 */
export async function processJobFromQueue(job: Job<JobInput>): Promise<void> {
  const { jobId, nfImportId, tipo, itemIds, grupoId } = job.data;

  const updateProgress = async (progress: JobProgress) => {
    await job.updateProgress(progress);
  };

  try {
    // Mark audit log as processing
    await update(TABLES.PROCESSING_JOBS, jobId, {
      status: 'processando',
      updated_at: new Date().toISOString(),
    }).catch(() => {}); // Non-critical

    const settings = await loadSettings();
    const isSearchJob = nfImportId === 'search';
    const searchTerm = isSearchJob ? (grupoId || '') : '';

    let items: NfItem[] = [];
    let nfImport: NfImport | null = null;

    if (!isSearchJob) {
      // Load NF data
      nfImport = await get<NfImport>(TABLES.NF_IMPORTS, nfImportId);
      const allItems = await list<NfItem>(TABLES.NF_ITEMS, {
        where: `(nf_import_id,eq,${nfImportId})`,
        limit: 200,
      });
      items = allItems.list.filter((item) => itemIds.includes(item.Id));

      if (items.length === 0) {
        throw new Error('Nenhum item encontrado para este job');
      }
    }

    // ========== SEARCH ==========
    await updateProgress({ step: 'pesquisando', message: isSearchJob ? `Pesquisando "${searchTerm}"...` : 'Buscando produto na web...' });

    let searchResult: Awaited<ReturnType<typeof searchProduct>>;

    if (isSearchJob) {
      // Search-based job: use the search term directly
      const { search: searxSearch } = await import('@/lib/firecrawl');
      const { classifyUrls } = await import('./classify-urls');

      const results = await withTimeout(
        searxSearch(searchTerm, 10),
        STEP_TIMEOUT_MS,
        'search'
      );

      const allUrls = results.map((r) => r.url);
      const classified = classifyUrls(allUrls);

      searchResult = {
        brand: '',
        allUrls,
        classified,
        rawResults: results,
        firecrawlCredits: 1,
      };
    } else {
      searchResult = await withTimeout(
        searchProduct({
          items,
          fornecedorCnpj: nfImport!.fornecedor_cnpj,
          fornecedorNome: nfImport!.fornecedor_nome,
          fornecedorFantasia: nfImport!.fornecedor_fantasia,
        }),
        STEP_TIMEOUT_MS,
        'search'
      );
    }

    await updateProgress({
      step: 'pesquisando',
      message: `Encontradas ${searchResult.allUrls.length} URLs`,
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
    });

    // ========== SCRAPE ==========
    await updateProgress({
      step: 'scraping',
      message: 'Extraindo dados das páginas...',
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
    });

    const scrapedData = await withTimeout(
      scrapePages(searchResult.classified),
      STEP_TIMEOUT_MS,
      'scrape'
    );

    const scrapingSummaries = scrapedData.map((d) => ({
      url: d.url,
      tipo: d.tipo,
      titulo: d.titulo,
      preco: d.preco,
      hasDescription: !!d.descricao,
      imageCount: d.imagens?.length || 0,
    }));

    await updateProgress({
      step: 'scraping',
      message: `Extraídas ${scrapedData.length} páginas`,
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
      scrapingResults: {
        pagesScraped: scrapedData.length,
        summaries: scrapingSummaries,
      },
    });

    // ========== IMAGES ==========
    await updateProgress({
      step: 'buscando_imagens',
      message: 'Coletando imagens...',
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
      scrapingResults: {
        pagesScraped: scrapedData.length,
        summaries: scrapingSummaries,
      },
    });

    const images = collectImages(scrapedData);

    await updateProgress({
      step: 'buscando_imagens',
      message: `${images.length} imagens encontradas`,
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
      scrapingResults: {
        pagesScraped: scrapedData.length,
        summaries: scrapingSummaries,
      },
      imagesFound: images.length,
    });

    // ========== GENERATE ==========
    await updateProgress({
      step: 'gerando',
      message: 'Gerando cadastro com IA...',
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
      scrapingResults: {
        pagesScraped: scrapedData.length,
        summaries: scrapingSummaries,
      },
      imagesFound: images.length,
    });

    // For search jobs without NF items, create a mock item from scraped data
    const effectiveItems = isSearchJob
      ? [{
          Id: 0, nf_import_id: 'search', n_item: 1,
          codigo: '', ean: null, ncm: '',
          descricao: searchTerm,
          cfop: '', unidade_comercial: 'UN',
          quantidade: 1, unidades_por_item: 1,
          valor_unitario: 0, valor_produto: 0, valor_ipi: 0,
          classificacao: null, grupo_id: null, selecionado: false,
          created_at: new Date().toISOString(),
        } as NfItem]
      : items;

    const generateResult = await withTimeout(
      generateProductDraft({
        items: effectiveItems,
        tipo: tipo as 'sem_variacao' | 'com_variacao' | 'multiplos_itens',
        brand: searchResult.brand,
        scrapedData,
        settings,
      }),
      STEP_TIMEOUT_MS,
      'generate'
    );
    const generated = generateResult.data;
    const openaiUsage = generateResult.usage;

    // ========== PRICE ==========
    const primaryItem = effectiveItems[0];
    const { custoUnitario, custoComIpi } = calculateUnitCost(primaryItem);
    const priceComposition = calculateSuggestedPrice(custoComIpi, {
      aliquota_impostos: Number(settings?.aliquota_impostos) || 6,
      margem_desejada: Number(settings?.margem_desejada) || 40,
      comissao_ecommerce: Number(settings?.comissao_ecommerce) || 0,
      frete_medio_unidade: Number(settings?.frete_medio_unidade) || 0,
      taxas_fixas: Number(settings?.taxas_fixas) || 0,
    });
    const avgPrices = calculateAveragePrices(scrapedData);

    const precosEncontrados: PriceFound[] = scrapedData
      .filter((d) => d.preco)
      .map((d) => ({
        fonte: d.tipo,
        url: d.url,
        preco: d.preco!,
        data: new Date().toISOString(),
      }));

    // ========== SAVE DRAFT (only output goes to NocoDB) ==========
    let variacoes = generated.variacoes || [];
    if (tipo === 'multiplos_itens' && items.length > 1) {
      variacoes = items.map((item) => ({
        nome: extractVariationName(item.descricao, items[0].descricao),
        sku: `${generated.sku_sugerido}-${item.codigo}`,
        ean: item.ean || '',
        atributos: {},
        imagens: [],
      }));
    }

    const now = new Date().toISOString();
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
      fornecedor_nome: nfImport?.fornecedor_fantasia || nfImport?.fornecedor_nome || null,
      fornecedor_cnpj: nfImport?.fornecedor_cnpj || null,
      codigo_fornecedor: primaryItem.codigo || null, // cProd da NF
      titulo_seo: generated.titulo_seo,
      descricao_seo: generated.descricao_seo,
      palavras_chave: generated.palavras_chave,
      openai_tokens: openaiUsage.total_tokens,
      firecrawl_credits: searchResult.firecrawlCredits + scrapedData.length, // searches + scrapes
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
      preco_final: psychologicalRound(priceComposition.preco_final),
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

    // Update audit log — only final status + timestamp
    await update(TABLES.PROCESSING_JOBS, jobId, {
      status: 'concluido',
      updated_at: now,
    }).catch(() => {});

    // Final progress
    await updateProgress({
      step: 'concluido',
      message: 'Produto cadastrado com sucesso',
      searchResults: {
        brand: searchResult.brand,
        urls: searchResult.classified,
        totalUrls: searchResult.allUrls.length,
      },
      scrapingResults: {
        pagesScraped: scrapedData.length,
        summaries: scrapingSummaries,
      },
      imagesFound: images.length,
      aiGenerated: true,
      priceCalculated: true,
      draftCreated: true,
    });

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erro desconhecido';
    console.error(`[Pipeline] Job ${jobId} failed:`, message);

    // Update audit log with error
    await update(TABLES.PROCESSING_JOBS, jobId, {
      status: 'erro',
      erro_mensagem: message,
      updated_at: new Date().toISOString(),
    }).catch(() => {});

    // Re-throw so BullMQ marks the job as failed
    throw error;
  }
}

/**
 * Inline fallback (no Redis). Used in dev only.
 */
export async function processJobInline(input: JobInput): Promise<void> {
  // Create a mock job object with updateProgress
  const mockProgress: JobProgress = { step: 'pendente' };
  const mockJob = {
    data: input,
    progress: mockProgress,
    updateProgress: async (p: JobProgress) => { Object.assign(mockProgress, p); },
  } as unknown as Job<JobInput>;

  await processJobFromQueue(mockJob);
}

function extractVariationName(itemDesc: string, baseDesc: string): string {
  const itemWords = itemDesc.toUpperCase().split(/\s+/);
  const baseWords = baseDesc.toUpperCase().split(/\s+/);
  const diff = itemWords.filter((w) => !baseWords.includes(w));
  if (diff.length > 0) {
    return diff.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');
  }
  return itemWords[itemWords.length - 1] || 'Variação';
}
