import { NextRequest, NextResponse } from 'next/server';
import { get, update, remove } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';
import { ProductUpdateSchema } from '@/lib/schemas';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await get<ProductDraft>(TABLES.PRODUCT_DRAFTS, id);
    return NextResponse.json(product);
  } catch (error) {
    console.error('Product get error:', error instanceof Error ? error.message : error);
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

    // Validate with Zod — only allowed fields pass through
    const parsed = ProductUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updated = await update<ProductDraft>(TABLES.PRODUCT_DRAFTS, id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });
    return NextResponse.json(updated);
  } catch (error) {
    console.error('Product update error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erro ao atualizar produto' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    await remove(TABLES.PRODUCT_DRAFTS, id);
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Product delete error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erro ao deletar produto' },
      { status: 500 }
    );
  }
}
