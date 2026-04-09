import { NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob, ProductDraft } from '@/lib/types';

export async function GET() {
  try {
    // Count processing jobs
    const processingJobs = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where: '(status,neq,concluido)~and(status,neq,erro)',
      limit: 1,
    });

    // Count product drafts by status
    const aguardando = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where: '(status,eq,aguardando)',
      limit: 1,
    });

    const aprovados = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where: '(status,eq,aprovado)~or(status,eq,enviado)',
      limit: 1,
    });

    return NextResponse.json({
      processando: processingJobs.totalRows,
      aguardando: aguardando.totalRows,
      aprovados: aprovados.totalRows,
    });
  } catch (error) {
    console.error('Counts error:', error);
    return NextResponse.json(
      { processando: 0, aguardando: 0, aprovados: 0 },
      { status: 200 }
    );
  }
}
