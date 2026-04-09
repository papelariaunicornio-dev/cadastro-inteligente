import { NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { NfImport } from '@/lib/types';

export async function GET() {
  try {
    const result = await list<NfImport>(TABLES.NF_IMPORTS, {
      sort: '-created_at',
      limit: 10,
      fields: 'Id,numero_nf,fornecedor_nome,fornecedor_fantasia,valor_total,data_emissao,created_at',
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Recent NFs error:', error);
    return NextResponse.json({ list: [], totalRows: 0 });
  }
}
