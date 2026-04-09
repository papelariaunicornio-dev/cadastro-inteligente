import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { NfItem } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ nfId: string }> }
) {
  const { nfId } = await params;

  try {
    const result = await list<NfItem>(TABLES.NF_ITEMS, {
      where: `(nf_import_id,eq,${nfId})`,
      sort: 'n_item',
      limit: 200,
    });

    return NextResponse.json(result.list);
  } catch (error) {
    console.error('Error fetching items:', error);
    return NextResponse.json(
      { error: 'Erro ao buscar itens' },
      { status: 500 }
    );
  }
}
