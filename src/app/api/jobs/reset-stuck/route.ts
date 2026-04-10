import { NextResponse } from 'next/server';
import { list, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { enqueueJob } from '@/lib/queue';

/**
 * Reset stuck/failed jobs and re-enqueue them in BullMQ.
 * Also picks up any orphaned 'pendente' jobs from NocoDB audit log.
 */
export async function POST() {
  try {
    // Find jobs that are stuck or errored in audit log
    const stuckJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,neq,concluido)',
      limit: 100,
    });

    const now = new Date().toISOString();
    let resetCount = 0;
    let enqueuedCount = 0;

    for (const job of stuckJobs.list) {
      // Reset status in audit log
      if (job.status !== 'pendente') {
        await update(TABLES.PROCESSING_JOBS, job.Id, {
          status: 'pendente',
          erro_mensagem: null,
          updated_at: now,
        });
        resetCount++;
      }

      // Re-enqueue in BullMQ
      const itemIds: number[] = JSON.parse(job.item_ids || '[]');
      await enqueueJob({
        jobId: job.Id,
        nfImportId: job.nf_import_id,
        tipo: job.tipo,
        itemIds,
        grupoId: job.grupo_id,
      });
      enqueuedCount++;
    }

    return NextResponse.json({
      success: true,
      reset: resetCount,
      enqueued: enqueuedCount,
      message: `${resetCount} jobs resetados, ${enqueuedCount} re-enfileirados no BullMQ`,
    });
  } catch (error) {
    console.error('Reset stuck error:', error);
    return NextResponse.json({ error: 'Erro ao resetar jobs' }, { status: 500 });
  }
}
