import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { JobStatusSchema } from '@/lib/schemas';
import { z } from 'zod';

const QuerySchema = z.object({
  nfImportId: z.string().regex(/^\d+$/).optional(),
  status: JobStatusSchema.optional(),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = QuerySchema.safeParse({
    nfImportId: searchParams.get('nfImportId') || undefined,
    status: searchParams.get('status') || undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos' },
      { status: 400 }
    );
  }

  try {
    const conditions: string[] = [];
    if (parsed.data.nfImportId) conditions.push(`(nf_import_id,eq,${parsed.data.nfImportId})`);
    if (parsed.data.status) conditions.push(`(status,eq,${parsed.data.status})`);

    const where = conditions.length > 0 ? conditions.join('~and') : undefined;

    const result = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where,
      sort: '-created_at',
      limit: 50,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Jobs list error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ list: [], totalRows: 0 });
  }
}
