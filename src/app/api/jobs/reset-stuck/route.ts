import { NextResponse } from 'next/server';
import { list, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { processJob } from '@/lib/processing/pipeline';

/**
 * Reset jobs stuck in intermediate states (not pendente/concluido/erro)
 * and reprocess them + any pending jobs.
 */
export async function POST() {
  try {
    // Find stuck jobs (in intermediate states for too long)
    const allJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,neq,concluido)~and(status,neq,erro)',
      limit: 100,
    });

    const now = Date.now();
    const resetIds: number[] = [];

    for (const job of allJobs.list) {
      const isStuck =
        job.status !== 'pendente' &&
        job.updated_at &&
        now - new Date(job.updated_at).getTime() > 5 * 60 * 1000; // 5 min

      if (isStuck) {
        await update(TABLES.PROCESSING_JOBS, job.Id, {
          status: 'pendente',
          erro_mensagem: null,
          updated_at: new Date().toISOString(),
        });
        resetIds.push(job.Id);
      }
    }

    // Now process all pending jobs (including freshly reset ones)
    const pendingJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,eq,pendente)',
      limit: 100,
    });

    // Fire-and-forget: process sequentially in background
    const jobIds = pendingJobs.list.map((j) => j.Id);
    if (jobIds.length > 0) {
      (async () => {
        for (const jid of jobIds) {
          await processJob(jid);
        }
      })().catch((err) => console.error('[ResetStuck] Processing error:', err));
    }

    return NextResponse.json({
      success: true,
      reset: resetIds.length,
      pending: jobIds.length,
      message: `${resetIds.length} jobs resetados, ${jobIds.length} jobs em fila para processamento`,
    });
  } catch (error) {
    console.error('Reset stuck error:', error);
    return NextResponse.json({ error: 'Erro ao resetar jobs' }, { status: 500 });
  }
}
