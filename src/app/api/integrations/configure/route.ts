/**
 * POST /api/integrations/configure
 *
 * Saves integration credentials encrypted into user_settings.
 * Never stores plaintext. Never logs tokens.
 *
 * Body: { integration: 'tiny' | 'shopify' | 'nuvemshop', ...fields }
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { list, create, update } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import { encrypt, isEncryptionAvailable } from '@/lib/crypto';
import { invalidateConfigCache } from '@/lib/integrations/config';
import type { UserSettings } from '@/lib/types';

const TinySchema = z.object({
  integration: z.literal('tiny'),
  token: z.string().min(1),
});

const ShopifySchema = z.object({
  integration: z.literal('shopify'),
  storeUrl: z.string().min(1),
  token: z.string().min(1),
});

const NuvemshopSchema = z.object({
  integration: z.literal('nuvemshop'),
  storeId: z.string().min(1),
  token: z.string().min(1),
});

const DeleteSchema = z.object({
  integration: z.enum(['tiny', 'shopify', 'nuvemshop']),
  action: z.literal('delete'),
});

const BodySchema = z.union([TinySchema, ShopifySchema, NuvemshopSchema, DeleteSchema]);

async function getOrCreateSettings(): Promise<UserSettings> {
  const result = await list<UserSettings>(TABLES.USER_SETTINGS, {
    where: '(user_id,eq,admin)',
    limit: 1,
  });

  if (result.list.length > 0) return result.list[0];

  return create<UserSettings>(TABLES.USER_SETTINGS, {
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
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
}

export async function POST(request: NextRequest) {
  try {
    if (!isEncryptionAvailable()) {
      return NextResponse.json(
        {
          error: 'Criptografia não configurada',
          detail: 'Defina a variável ENCRYPTION_KEY no servidor (64 caracteres hex).',
        },
        { status: 503 }
      );
    }

    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const settings = await getOrCreateSettings();
    const now = new Date().toISOString();
    let patch: Partial<UserSettings> = { updated_at: now };

    const data = parsed.data;

    if ('action' in data && data.action === 'delete') {
      // Remove credentials
      if (data.integration === 'tiny') {
        patch = { ...patch, tiny_token_encrypted: null };
      } else if (data.integration === 'shopify') {
        patch = { ...patch, shopify_token_encrypted: null, shopify_url: null };
      } else if (data.integration === 'nuvemshop') {
        patch = { ...patch, nuvemshop_token_encrypted: null, nuvemshop_store_id: null };
      }
    } else if (data.integration === 'tiny') {
      patch = { ...patch, tiny_token_encrypted: encrypt(data.token) };
    } else if (data.integration === 'shopify') {
      patch = {
        ...patch,
        shopify_token_encrypted: encrypt(data.token),
        shopify_url: data.storeUrl.replace(/^https?:\/\//, '').replace(/\/$/, ''),
      };
    } else if (data.integration === 'nuvemshop') {
      patch = {
        ...patch,
        nuvemshop_token_encrypted: encrypt(data.token),
        nuvemshop_store_id: data.storeId,
      };
    }

    await update<UserSettings>(TABLES.USER_SETTINGS, settings.Id, patch);

    // Bust the in-process config cache
    invalidateConfigCache();

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Integration configure error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro ao salvar credenciais' }, { status: 500 });
  }
}
