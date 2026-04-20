import { NextRequest, NextResponse } from 'next/server';
import { list, create, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { UserSettings } from '@/lib/types';
import { UserSettingsUpdateSchema } from '@/lib/schemas';
import { requireAuth } from '@/lib/session';

function defaultSettings(userId: string): Partial<UserSettings> {
  return {
    user_id: userId,
    regime_tributario: 'simples_nacional',
    aliquota_impostos: 6,
    margem_desejada: 40,
    comissao_ecommerce: 0,
    comissao_ml: 16,
    comissao_shopee: 20,
    frete_medio_unidade: 0,
    taxas_fixas: 0,
    tamanho_max_titulo: 150,
    incluir_specs: true,
    prefixo_sku: '',
    sequencia_sku: 1,
  };
}

async function getOrCreateSettings(userId: string): Promise<UserSettings> {
  const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
    where: `(user_id,eq,${userId})`,
    limit: 1,
  });

  if (result.list.length > 0) return result.list[0];

  const now = new Date().toISOString();
  return create<UserSettings>(TABLES.USER_SETTINGS, {
    ...defaultSettings(userId),
    created_at: now,
    updated_at: now,
  });
}

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const settings = await getOrCreateSettings(auth.user.id);

    // Never expose encrypted values — mask them
    return NextResponse.json({
      ...settings,
      tiny_token_encrypted: settings.tiny_token_encrypted ? '••••••••' : null,
      shopify_token_encrypted: settings.shopify_token_encrypted ? '••••••••' : null,
      nuvemshop_token_encrypted: settings.nuvemshop_token_encrypted ? '••••••••' : null,
    });
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json({ error: 'Erro ao carregar configurações' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const body = await request.json();

    const parsed = UserSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings(auth.user.id);

    const updated = await update<UserSettings>(TABLES.USER_SETTINGS, settings.Id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json({ error: 'Erro ao salvar configurações' }, { status: 500 });
  }
}
