import { NextResponse } from 'next/server';
import { list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProductDraft } from '@/lib/types';

/**
 * Returns total API costs across all products.
 */
export async function GET() {
  try {
    const result = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      fields: 'Id,openai_tokens,firecrawl_credits',
      limit: 1000,
    });

    let totalTokens = 0;
    let totalCredits = 0;
    let productCount = 0;

    for (const p of result.list) {
      if (p.openai_tokens || p.firecrawl_credits) {
        productCount++;
        totalTokens += Number(p.openai_tokens) || 0;
        totalCredits += Number(p.firecrawl_credits) || 0;
      }
    }

    return NextResponse.json({
      totalTokens,
      totalCredits,
      productCount,
      avgTokensPerProduct: productCount > 0 ? Math.round(totalTokens / productCount) : 0,
      avgCreditsPerProduct: productCount > 0 ? Math.round((totalCredits / productCount) * 10) / 10 : 0,
    });
  } catch (error) {
    console.error('Costs error:', error);
    return NextResponse.json({
      totalTokens: 0,
      totalCredits: 0,
      productCount: 0,
      avgTokensPerProduct: 0,
      avgCreditsPerProduct: 0,
    });
  }
}
