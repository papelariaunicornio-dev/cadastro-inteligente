import { NextRequest, NextResponse } from 'next/server';
import { list, create, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { UserSettings } from '@/lib/types';
import { UserSettingsUpdateSchema } from '@/lib/schemas';

const DEFAULT_SETTINGS: Partial<UserSettings> = {
  user_id: 'admin',
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

async function getOrCreateSettings(): Promise<UserSettings> {
  const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
    where: '(user_id,eq,admin)',
    limit: 1,
  });

  if (result.list.length > 0) {
    return result.list[0];
  }

  // Create default settings
  const now = new Date().toISOString();
  return create<UserSettings>(TABLES.USER_SETTINGS, {
    ...DEFAULT_SETTINGS,
    created_at: now,
    updated_at: now,
  });
}

export async function GET() {
  try {
    const settings = await getOrCreateSettings();

    // Mask encrypted tokens
    const masked = {
      ...settings,
      tiny_token_encrypted: settings.tiny_token_encrypted
        ? `****${settings.tiny_token_encrypted.slice(-4)}`
        : null,
      shopify_token_encrypted: settings.shopify_token_encrypted
        ? `****${settings.shopify_token_encrypted.slice(-4)}`
        : null,
    };

    return NextResponse.json(masked);
  } catch (error) {
    console.error('Settings GET error:', error);
    return NextResponse.json(
      { error: 'Erro ao carregar configurações' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();

    // Validate with Zod — business rules in code, not DB
    const parsed = UserSettingsUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings();

    const updated = await update<UserSettings>(TABLES.USER_SETTINGS, settings.Id, {
      ...parsed.data,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Settings PUT error:', error);
    return NextResponse.json(
      { error: 'Erro ao salvar configurações' },
      { status: 500 }
    );
  }
}
