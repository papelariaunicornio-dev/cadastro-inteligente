import { NextRequest, NextResponse } from 'next/server';
import { list, get } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob, NfItem, NfImport } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const statusFilter = searchParams.get('status');

  try {
    const where = statusFilter
      ? `(status,eq,${statusFilter})`
      : undefined;

    const result = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where,
      sort: '-created_at',
      limit: 100,
    });

    // Enrich each job with item descriptions and NF info
    const enriched = await Promise.all(
      result.list.map(async (job) => {
        let itemDescriptions: string[] = [];
        let nfInfo: { numero_nf: string; fornecedor: string } | null = null;

        try {
          // Get NF info
          const nf = await get<NfImport>(TABLES.NF_IMPORTS, job.nf_import_id);
          nfInfo = {
            numero_nf: nf.numero_nf,
            fornecedor: nf.fornecedor_fantasia || nf.fornecedor_nome,
          };
        } catch { /* ignore */ }

        try {
          // Get item descriptions
          const itemIds: number[] = JSON.parse(job.item_ids || '[]');
          if (itemIds.length > 0) {
            const allItems = await list<NfItem>(TABLES.NF_ITEMS, {
              where: `(nf_import_id,eq,${job.nf_import_id})`,
              limit: 200,
              fields: 'Id,descricao,codigo,ean',
            });
            itemDescriptions = allItems.list
              .filter((item) => itemIds.includes(item.Id))
              .map((item) => item.descricao);
          }
        } catch { /* ignore */ }

        // Parse JSON fields safely
        let urlsEncontradas = null;
        let dadosScraping = null;
        try { urlsEncontradas = JSON.parse(job.urls_encontradas || 'null'); } catch { /* ignore */ }
        try { dadosScraping = JSON.parse(job.dados_scraping || 'null'); } catch { /* ignore */ }

        // Calculate duration
        const createdAt = new Date(job.created_at).getTime();
        const updatedAt = new Date(job.updated_at).getTime();
        const durationMs = updatedAt - createdAt;

        return {
          id: job.Id,
          status: job.status,
          tipo: job.tipo,
          erro_mensagem: job.erro_mensagem,
          created_at: job.created_at,
          updated_at: job.updated_at,
          duration_seconds: Math.round(durationMs / 1000),
          nf: nfInfo,
          items: itemDescriptions,
          item_count: itemDescriptions.length,
          urls_encontradas: urlsEncontradas,
          dados_scraping: dadosScraping,
          has_prompt: !!job.prompt_enviado,
          has_response: !!job.resposta_ia,
        };
      })
    );

    return NextResponse.json({
      list: enriched,
      totalRows: result.totalRows,
      summary: {
        total: result.totalRows,
        pendente: result.list.filter((j) => j.status === 'pendente').length,
        pesquisando: result.list.filter((j) => j.status === 'pesquisando').length,
        scraping: result.list.filter((j) => j.status === 'scraping').length,
        buscando_imagens: result.list.filter((j) => j.status === 'buscando_imagens').length,
        gerando: result.list.filter((j) => j.status === 'gerando').length,
        concluido: result.list.filter((j) => j.status === 'concluido').length,
        erro: result.list.filter((j) => j.status === 'erro').length,
      },
    });
  } catch (error) {
    console.error('Detailed jobs error:', error);
    return NextResponse.json({ list: [], totalRows: 0, summary: {} }, { status: 500 });
  }
}
