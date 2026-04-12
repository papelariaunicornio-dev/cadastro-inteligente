import { NextRequest, NextResponse } from 'next/server';
import { get, update, list, remove } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob, ProductDraft } from '@/lib/types';
import { enqueueJob } from '@/lib/queue';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const id = parseInt(jobId, 10);

  try {
    const job = await get<ProcessingJob>(TABLES.PROCESSING_JOBS, id);

    // Parse itemIds — handle both array and search_term format
    let itemIds: number[] = [];
    try {
      const parsed = JSON.parse(job.item_ids || '[]');
      if (Array.isArray(parsed)) itemIds = parsed;
    } catch { /* search job — itemIds stay empty */ }

    // Delete existing draft if reprocessing a completed job
    if (job.status === 'concluido') {
      const drafts = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
        where: `(job_id,eq,${id})`,
        limit: 10,
      });
      for (const draft of drafts.list) {
        await remove(TABLES.PRODUCT_DRAFTS, draft.Id);
      }
    }

    // Reset audit log
    await update(TABLES.PROCESSING_JOBS, id, {
      status: 'pendente',
      erro_mensagem: null,
      updated_at: new Date().toISOString(),
    });

    // Re-enqueue in BullMQ
    await enqueueJob({
      jobId: id,
      nfImportId: job.nf_import_id,
      tipo: job.tipo,
      itemIds,
      grupoId: job.grupo_id,
    });

    return NextResponse.json({ success: true, message: `Job ${jobId} re-enqueued` });
  } catch (error) {
    console.error('Retry error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro ao reprocessar' }, { status: 500 });
  }
}
