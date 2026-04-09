import { NextRequest, NextResponse } from 'next/server';
import { get } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  try {
    const job = await get<ProcessingJob>(TABLES.PROCESSING_JOBS, jobId);

    return NextResponse.json({
      id: job.Id,
      status: job.status,
      tipo: job.tipo,
      erro_mensagem: job.erro_mensagem,
    });
  } catch (error) {
    console.error('Job status error:', error);
    return NextResponse.json(
      { error: 'Job não encontrado' },
      { status: 404 }
    );
  }
}
