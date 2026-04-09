import { NextRequest, NextResponse } from 'next/server';
import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  try {
    const product = await get<ProductDraft>(TABLES.PRODUCT_DRAFTS, id);

    if (product.status !== 'aguardando') {
      return NextResponse.json(
        { error: `Produto não está aguardando aprovação (status: ${product.status})` },
        { status: 400 }
      );
    }

    // Update status to approved
    await update(TABLES.PRODUCT_DRAFTS, id, {
      status: 'aprovado',
      updated_at: new Date().toISOString(),
    });

    // TODO: Trigger send to Tiny/Shopify based on destino_envio
    // For now, just mark as approved

    return NextResponse.json({ success: true, status: 'aprovado' });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: 'Erro ao aprovar produto' },
      { status: 500 }
    );
  }
}
