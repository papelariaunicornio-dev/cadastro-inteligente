import { NextRequest, NextResponse } from 'next/server';
import { create } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob, ItemClassification } from '@/lib/types';
import { processAllPendingJobs } from '@/lib/processing/pipeline';

interface JobRequest {
  nfImportId: string;
  jobs: {
    tipo: ItemClassification;
    itemIds: number[];
    grupoId: string | null;
  }[];
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as JobRequest;
    const now = new Date().toISOString();

    const createdJobs: ProcessingJob[] = [];

    for (const job of body.jobs) {
      const created = await create<ProcessingJob>(TABLES.PROCESSING_JOBS, {
        user_id: 'admin',
        nf_import_id: body.nfImportId,
        tipo: job.tipo,
        status: 'pendente',
        item_ids: JSON.stringify(job.itemIds),
        grupo_id: job.grupoId,
        created_at: now,
        updated_at: now,
      });
      createdJobs.push(created);
    }

    // Fire-and-forget: start processing in background
    // Don't await — let the response return immediately
    processAllPendingJobs(body.nfImportId).catch((err) =>
      console.error('[Jobs] Background processing error:', err)
    );

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
