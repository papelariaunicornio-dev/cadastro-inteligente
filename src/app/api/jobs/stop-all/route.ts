import { NextResponse } from 'next/server';
import { list, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';

/**
 * Stop all active/pending jobs by marking them as erro.
 */
export async function POST() {
  try {
    const activeJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,neq,concluido)~and(status,neq,erro)',
      limit: 100,
    });

    const now = new Date().toISOString();
    let stopped = 0;

    for (const job of activeJobs.list) {
      await update(TABLES.PROCESSING_JOBS, job.Id, {
        status: 'erro',
        erro_mensagem: 'Parado manualmente pelo usuario',
        updated_at: now,
      });
      stopped++;
    }

    // TODO: Also clear BullMQ queue if Redis available
    try {
      const { Queue } = await import('bullmq');
      const IORedis = (await import('ioredis')).default;
      const redisUrl = process.env.REDIS_URL;
      if (redisUrl) {
        const connection = new IORedis(redisUrl, { maxRetriesPerRequest: null, connectTimeout: 3000 });
        const queue = new Queue('product-processing', { connection });
        await queue.obliterate({ force: true });
        await connection.quit();
      }
    } catch { /* Redis not available, just mark in DB */ }

    return NextResponse.json({
      success: true,
      stopped,
      message: `${stopped} job(s) parado(s)`,
    });
  } catch (error) {
    console.error('Stop all error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro ao parar jobs' }, { status: 500 });
  }
}
