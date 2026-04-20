import { NextRequest, NextResponse } from 'next/server';
import { create } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { JobRequestSchema } from '@/lib/schemas';
import { enqueueJob } from '@/lib/queue';
import { requireAuth } from '@/lib/session';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const raw = await request.json();
    const parsed = JobRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { nfImportId, jobs } = parsed.data;
    const now = new Date().toISOString();
    const createdJobs: ProcessingJob[] = [];

    for (const job of jobs) {
      // Create slim audit log in NocoDB (not the queue)
      const auditRow = await create<ProcessingJob>(TABLES.PROCESSING_JOBS, {
        user_id: auth.user.id,
        nf_import_id: nfImportId,
        tipo: job.tipo,
        status: 'pendente',
        item_ids: JSON.stringify(job.itemIds),
        grupo_id: job.grupoId,
        created_at: now,
        updated_at: now,
      });
      createdJobs.push(auditRow);

      // Enqueue in BullMQ (source of truth for processing)
      await enqueueJob({
        jobId: auditRow.Id,
        nfImportId,
        tipo: job.tipo,
        itemIds: job.itemIds,
        grupoId: job.grupoId,
        userId: auth.user.id,
      });
    }

    return NextResponse.json({
      success: true,
      jobs: createdJobs,
    });
  } catch (error) {
    console.error('Job creation error:', error);
    return NextResponse.json(
      { error: 'Erro ao criar jobs de processamento' },
      { status: 500 }
    );
  }
}
