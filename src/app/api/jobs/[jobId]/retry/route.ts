import { NextRequest, NextResponse } from 'next/server';
import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { processJob } from '@/lib/processing/pipeline';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const id = parseInt(jobId, 10);

  try {
    const job = await get<ProcessingJob>(TABLES.PROCESSING_JOBS, id);

    if (job.status !== 'erro') {
      return NextResponse.json(
        { error: 'Só é possível reprocessar jobs com erro' },
        { status: 400 }
      );
    }

    // Reset status
    await update(TABLES.PROCESSING_JOBS, id, {
      status: 'pendente',
      erro_mensagem: null,
      updated_at: new Date().toISOString(),
    });

    // Fire-and-forget
    processJob(id).catch((err) =>
      console.error(`[Retry] Job ${id} error:`, err)
    );

    return NextResponse.json({ success: true, message: `Job ${jobId} reprocessing` });
  } catch (error) {
    console.error('Retry error:', error);
    return NextResponse.json({ error: 'Erro ao reprocessar' }, { status: 500 });
  }
}
