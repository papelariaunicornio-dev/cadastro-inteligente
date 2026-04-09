import { NextRequest, NextResponse } from 'next/server';
import { get, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';
import { sendProduct } from '@/lib/integrations/send';

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

    // Mark as approved first
    await update(TABLES.PRODUCT_DRAFTS, id, {
      status: 'aprovado',
      updated_at: new Date().toISOString(),
    });

    // Try to send to configured integrations
    const hasIntegrations =
      process.env.TINY_ERP_TOKEN ||
      (process.env.SHOPIFY_STORE_URL && process.env.SHOPIFY_ACCESS_TOKEN);

    let sendResult = null;
    if (hasIntegrations) {
      try {
        sendResult = await sendProduct(id);
      } catch (error) {
        console.error('Send error (non-blocking):', error);
        // Don't fail the approval if send fails — product stays approved
      }
    }

    return NextResponse.json({
      success: true,
      status: 'aprovado',
      sendResult,
      message: hasIntegrations
        ? 'Produto aprovado e enviado para as integrações'
        : 'Produto aprovado (nenhuma integração configurada)',
    });
  } catch (error) {
    console.error('Approve error:', error);
    return NextResponse.json(
      { error: 'Erro ao aprovar produto' },
      { status: 500 }
    );
  }
}
