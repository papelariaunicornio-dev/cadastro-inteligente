import { NextRequest, NextResponse } from 'next/server';
import { searchImages } from '@/lib/firecrawl';

/**
 * Search for product images by query.
 * Returns image URLs from Firecrawl search + scrape.
 */
export async function POST(request: NextRequest) {
  try {
    const { query } = await request.json();

    if (!query || typeof query !== 'string' || query.length < 2) {
      return NextResponse.json({ error: 'Query invalida' }, { status: 400 });
    }

    const results = await searchImages(query, 20);

    return NextResponse.json({
      images: results.map((r) => ({
        url: r.url,
        source: r.source,
        title: r.title,
      })),
      total: results.length,
    });
  } catch (error) {
    console.error('Image search error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro na busca' }, { status: 500 });
  }
}
