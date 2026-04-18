/**
 * POST /api/integrations/test
 *
 * Tests connectivity for a given integration using stored credentials.
 * Returns { ok, message } — never exposes the token.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTinyToken, getShopifyConfig, getNuvemshopConfig } from '@/lib/integrations/config';

const BodySchema = z.object({
  integration: z.enum(['tiny', 'shopify', 'nuvemshop', 'firecrawl', 'openai']),
});

async function testTiny(): Promise<{ ok: boolean; message: string }> {
  const token = await getTinyToken();
  if (!token) return { ok: false, message: 'Token não configurado' };

  try {
    const formData = new URLSearchParams({ token, formato: 'JSON' });
    const res = await fetch('https://api.tiny.com.br/api2/info.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    const data = (await res.json()) as { retorno?: { status?: string; dados?: { nome?: string } } };
    const status = data?.retorno?.status;

    if (status === 'OK') {
      const nome = data?.retorno?.dados?.nome || 'Conta conectada';
      return { ok: true, message: nome };
    }

    return { ok: false, message: `Resposta inesperada: ${status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

async function testShopify(): Promise<{ ok: boolean; message: string }> {
  const config = await getShopifyConfig();
  if (!config) return { ok: false, message: 'Shopify não configurado' };

  try {
    const res = await fetch(
      `https://${config.storeUrl}/admin/api/2024-01/shop.json`,
      {
        headers: { 'X-Shopify-Access-Token': config.token },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    const data = (await res.json()) as { shop?: { name?: string; domain?: string } };
    const name = data?.shop?.name || config.storeUrl;
    return { ok: true, message: name };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

async function testNuvemshop(): Promise<{ ok: boolean; message: string }> {
  const config = await getNuvemshopConfig();
  if (!config) return { ok: false, message: 'Nuvemshop não configurado' };

  try {
    const res = await fetch(
      `https://api.nuvemshop.com.br/v1/${config.storeId}/store`,
      {
        headers: {
          Authentication: `bearer ${config.token}`,
          'User-Agent': 'Skuni (skuni@papelariaunicornio.com.br)',
        },
        signal: AbortSignal.timeout(8000),
      }
    );

    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    const data = (await res.json()) as { name?: { pt?: string } };
    const name = data?.name?.pt || 'Loja conectada';
    return { ok: true, message: name };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

async function testFirecrawl(): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) return { ok: false, message: 'FIRECRAWL_API_KEY não configurada' };

  try {
    const res = await fetch('https://api.firecrawl.dev/v1/scrape', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ url: 'https://example.com', formats: ['markdown'] }),
      signal: AbortSignal.timeout(15000),
    });

    if (res.status === 401) return { ok: false, message: 'API key inválida' };
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    return { ok: true, message: 'API key válida' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

async function testOpenAI(): Promise<{ ok: boolean; message: string }> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return { ok: false, message: 'OPENAI_API_KEY não configurada' };

  try {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 401) return { ok: false, message: 'API key inválida' };
    if (!res.ok) return { ok: false, message: `HTTP ${res.status}` };

    return { ok: true, message: 'API key válida' };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : 'Erro de conexão' };
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = BodySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: 'Integração inválida' }, { status: 400 });
    }

    const { integration } = parsed.data;

    let result: { ok: boolean; message: string };

    switch (integration) {
      case 'tiny':
        result = await testTiny();
        break;
      case 'shopify':
        result = await testShopify();
        break;
      case 'nuvemshop':
        result = await testNuvemshop();
        break;
      case 'firecrawl':
        result = await testFirecrawl();
        break;
      case 'openai':
        result = await testOpenAI();
        break;
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Integration test error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ ok: false, message: 'Erro interno' }, { status: 500 });
  }
}
