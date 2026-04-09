import { NextRequest, NextResponse } from 'next/server';
import { update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ItemClassification } from '@/lib/types';

interface SelectionItem {
  itemId: number;
  classificacao: ItemClassification;
  grupoId: string | null;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nfId: string }> }
) {
  const { nfId: _nfId } = await params;

  try {
    const body = (await request.json()) as { selections: SelectionItem[] };

    // Update each item with its classification
    const updates = body.selections.map((sel) =>
      update(TABLES.NF_ITEMS, sel.itemId, {
        classificacao: sel.classificacao,
        grupo_id: sel.grupoId,
        selecionado: true,
      })
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true, count: body.selections.length });
  } catch (error) {
    console.error('Selection error:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar seleções' },
      { status: 500 }
    );
  }
}
