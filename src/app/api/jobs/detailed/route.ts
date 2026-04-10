import { NextResponse } from 'next/server';
import { getAllJobStatuses } from '@/lib/queue';
import { list, get } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { NfImport, NfItem, ProcessingJob } from '@/lib/types';

/**
 * Returns detailed job status.
 * Primary source: BullMQ/Redis (live status + intermediate data)
 * Fallback: NocoDB audit log (when Redis unavailable)
 */
export async function GET() {
  try {
    // Try BullMQ first (source of truth)
    const queueJobs = await getAllJobStatuses();

    if (queueJobs.length > 0) {
      // Enrich with item descriptions from NocoDB
      const enriched = await Promise.all(
        queueJobs.map(async (qj) => {
          let itemDescriptions: string[] = [];
          let nfInfo: { numero_nf: string; fornecedor: string } | null = null;

          try {
            const nf = await get<NfImport>(TABLES.NF_IMPORTS, qj.input.nfImportId);
            nfInfo = { numero_nf: nf.numero_nf, fornecedor: nf.fornecedor_fantasia || nf.fornecedor_nome };
          } catch { /* ignore */ }

          try {
            if (qj.input.itemIds.length > 0) {
              const allItems = await list<NfItem>(TABLES.NF_ITEMS, {
                where: `(nf_import_id,eq,${qj.input.nfImportId})`,
                limit: 200,
                fields: 'Id,descricao',
              });
              itemDescriptions = allItems.list
                .filter((item) => qj.input.itemIds.includes(item.Id))
                .map((item) => item.descricao);
            }
          } catch { /* ignore */ }

          return {
            id: qj.jobId,
            bullmq_id: qj.bullmqId,
            status: qj.progress.step,
            tipo: qj.input.tipo,
            erro_mensagem: qj.progress.error || null,
            message: qj.progress.message || null,
            created_at: new Date(qj.timestamp).toISOString(),
            duration_seconds: Math.round(qj.duration / 1000),
            nf: nfInfo,
            items: itemDescriptions,
            item_count: qj.input.itemIds.length,
            // Live data from Redis
            urls_encontradas: qj.progress.searchResults?.urls || null,
            search_brand: qj.progress.searchResults?.brand || null,
            search_total_urls: qj.progress.searchResults?.totalUrls || 0,
            dados_scraping: qj.progress.scrapingResults?.summaries || null,
            pages_scraped: qj.progress.scrapingResults?.pagesScraped || 0,
            images_found: qj.progress.imagesFound || 0,
            ai_generated: qj.progress.aiGenerated || false,
            price_calculated: qj.progress.priceCalculated || false,
            draft_created: qj.progress.draftCreated || false,
            source: 'bullmq' as const,
          };
        })
      );

      const summary = {
        total: enriched.length,
        pendente: enriched.filter((j) => j.status === 'pendente').length,
        pesquisando: enriched.filter((j) => j.status === 'pesquisando').length,
        scraping: enriched.filter((j) => j.status === 'scraping').length,
        buscando_imagens: enriched.filter((j) => j.status === 'buscando_imagens').length,
        gerando: enriched.filter((j) => j.status === 'gerando').length,
        concluido: enriched.filter((j) => j.status === 'concluido').length,
        erro: enriched.filter((j) => j.status === 'erro').length,
      };

      return NextResponse.json({ list: enriched, totalRows: enriched.length, summary, source: 'bullmq' });
    }

    // Fallback: read from NocoDB audit log
    const result = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      sort: '-created_at',
      limit: 100,
    });

    const enriched = await Promise.all(
      result.list.map(async (job) => {
        let itemDescriptions: string[] = [];
        let nfInfo: { numero_nf: string; fornecedor: string } | null = null;
        try {
          const nf = await get<NfImport>(TABLES.NF_IMPORTS, job.nf_import_id);
          nfInfo = { numero_nf: nf.numero_nf, fornecedor: nf.fornecedor_fantasia || nf.fornecedor_nome };
        } catch { /* ignore */ }
        try {
          const itemIds: number[] = JSON.parse(job.item_ids || '[]');
          const allItems = await list<NfItem>(TABLES.NF_ITEMS, {
            where: `(nf_import_id,eq,${job.nf_import_id})`,
            limit: 200,
            fields: 'Id,descricao',
          });
          itemDescriptions = allItems.list.filter((i) => itemIds.includes(i.Id)).map((i) => i.descricao);
        } catch { /* ignore */ }

        return {
          id: job.Id,
          bullmq_id: null,
          status: job.status,
          tipo: job.tipo,
          erro_mensagem: job.erro_mensagem,
          message: null,
          created_at: job.created_at,
          duration_seconds: Math.round((new Date(job.updated_at).getTime() - new Date(job.created_at).getTime()) / 1000),
          nf: nfInfo,
          items: itemDescriptions,
          item_count: itemDescriptions.length,
          urls_encontradas: null,
          search_brand: null,
          search_total_urls: 0,
          dados_scraping: null,
          pages_scraped: 0,
          images_found: 0,
          ai_generated: false,
          price_calculated: false,
          draft_created: job.status === 'concluido',
          source: 'nocodb' as const,
        };
      })
    );

    const summary = {
      total: enriched.length,
      pendente: enriched.filter((j) => j.status === 'pendente').length,
      pesquisando: enriched.filter((j) => j.status === 'pesquisando').length,
      scraping: enriched.filter((j) => j.status === 'scraping').length,
      buscando_imagens: enriched.filter((j) => j.status === 'buscando_imagens').length,
      gerando: enriched.filter((j) => j.status === 'gerando').length,
      concluido: enriched.filter((j) => j.status === 'concluido').length,
      erro: enriched.filter((j) => j.status === 'erro').length,
    };

    return NextResponse.json({ list: enriched, totalRows: enriched.length, summary, source: 'nocodb' });
  } catch (error) {
    console.error('Detailed jobs error:', error);
    return NextResponse.json({ list: [], totalRows: 0, summary: {}, source: 'error' }, { status: 500 });
  }
}
