import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { enqueueJob } from '@/lib/queue';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const id = parseInt(jobId, 10);

  try {
    const job = await get<ProcessingJob>(TABLES.PROCESSING_JOBS, id);
    const itemIds: number[] = JSON.parse(job.item_ids || '[]');

    await enqueueJob({
      jobId: id,
      nfImportId: job.nf_import_id,
      tipo: job.tipo,
      itemIds,
      grupoId: job.grupo_id,
    });

    return NextResponse.json({ success: true, message: `Job ${jobId} enqueued` });
  } catch (error) {
    console.error(`Process error:`, error);
    return NextResponse.json({ error: 'Erro ao enfileirar job' }, { status: 500 });
  }
}
