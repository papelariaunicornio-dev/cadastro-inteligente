import { NextRequest, NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';
import { DraftStatusSchema } from '@/lib/schemas';
import { z } from 'zod';

const QuerySchema = z.object({
  status: DraftStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;

  const parsed = QuerySchema.safeParse({
    status: searchParams.get('status') || undefined,
    limit: searchParams.get('limit') || 50,
    offset: searchParams.get('offset') || 0,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Parâmetros inválidos' },
      { status: 400 }
    );
  }

  try {
    const { status, limit, offset } = parsed.data;
    const where = status ? `(status,eq,${status})` : undefined;

    const result = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where,
      sort: '-created_at',
      limit,
      offset,
    });

    return NextResponse.json(result);
  } catch (error) {
    console.error('Products list error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erro ao listar produtos' },
      { status: 500 }
    );
  }
}
