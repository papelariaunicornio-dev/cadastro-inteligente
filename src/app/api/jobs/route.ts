import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const nfImportId = searchParams.get('nfImportId');
  const status = searchParams.get('status');

  try {
    const conditions: string[] = [];
    if (nfImportId) conditions.push(`(nf_import_id,eq,${nfImportId})`);
    if (status) conditions.push(`(status,eq,${status})`);

    const where = conditions.length > 0 ? conditions.join('~and') : undefined;

    const result = await list<ProcessingJob>(TABLES.PROCESSING_JOBS, {
      where,
      sort: '-created_at',
      limit: 50,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Jobs list error:', error);
    return NextResponse.json({ list: [], totalRows: 0 });
  }
}
