import { NextResponse } from 'next/server';
import { list, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { enqueueJob } from '@/lib/queue';

/**
 * Reset jobs stuck in intermediate states (not pendente/concluido/erro)
 * and re-enqueue them + any pending jobs via BullMQ.
 */
export async function POST() {
  try {
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

    // Re-fetch all pending jobs and enqueue them
    const pendingJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,eq,pendente)',
      limit: 100,
    });

    const jobIds = pendingJobs.list.map((j) => j.Id);
    for (const jid of jobIds) {
      await enqueueJob(jid);
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
