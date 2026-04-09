import { NextRequest, NextResponse } from 'next/server';
import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await get<ProductDraft>(TABLES.PRODUCT_DRAFTS, id);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Product get error:', error);
    return NextResponse.json(
      { error: 'Produto não encontrado' },
      { status: 404 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const body = await request.json();
    const updated = await update<ProductDraft>(TABLES.PRODUCT_DRAFTS, id, {
      ...body,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Product update error:', error);
    return NextResponse.json(
      { error: 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}
