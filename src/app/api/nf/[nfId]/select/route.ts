import { NextRequest, NextResponse } from 'next/server';
import { update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import { SelectionRequestSchema } from '@/lib/schemas';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ nfId: string }> }
) {
  const { nfId: _nfId } = await params;

  try {
    const body = await request.json();

    // Validate with Zod
    const parsed = SelectionRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const updates = parsed.data.selections.map((sel) =>
      update(TABLES.NF_ITEMS, sel.itemId, {
        classificacao: sel.classificacao,
        grupo_id: sel.grupoId,
        selecionado: true,
      })
    );

    await Promise.all(updates);

    return NextResponse.json({ success: true, count: parsed.data.selections.length });
  } catch (error) {
    console.error('Selection error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erro ao salvar seleções' },
      { status: 500 }
    );
  }
}
