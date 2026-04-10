import { NextRequest, NextResponse } from 'next/server';
import { create } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { JobRequestSchema } from '@/lib/schemas';
import { enqueueJob } from '@/lib/queue';

export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();

    // Validate input with Zod
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
      const created = await create<ProcessingJob>(TABLES.PROCESSING_JOBS, {
        user_id: 'admin',
        nf_import_id: nfImportId,
        tipo: job.tipo,
        status: 'pendente',
        item_ids: JSON.stringify(job.itemIds),
        grupo_id: job.grupoId,
        created_at: now,
        updated_at: now,
      });
      createdJobs.push(created);

      // Enqueue for processing (BullMQ/Redis or inline fallback)
      await enqueueJob(created.Id);
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
