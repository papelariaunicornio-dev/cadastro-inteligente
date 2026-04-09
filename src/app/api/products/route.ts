import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = searchParams.get('status');
  const limitParam = searchParams.get('limit');
  const offsetParam = searchParams.get('offset');

  try {
    const where = status ? `(status,eq,${status})` : undefined;

    const result = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where,
      sort: '-created_at',
      limit: limitParam ? parseInt(limitParam, 10) : 50,
      offset: offsetParam ? parseInt(offsetParam, 10) : 0,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Products list error:', error);
    return NextResponse.json(
      { error: 'Erro ao listar produtos' },
      { status: 500 }
    );
  }
}
