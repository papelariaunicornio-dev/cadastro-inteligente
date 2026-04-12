/**
 * Image extraction, search, and deduplication.
 *
 * Two sources:
 * - "scrape": extracted from pages scraped by Firecrawl
 * - "searxng": dedicated image search via searchImages()
 */

import type { ScrapedData, ProductImage } from '@/lib/types';
import { searchImages as firecrawlSearchImages } from '@/lib/firecrawl';

const MIN_DIMENSION = 300;

/**
 * Collect images from scraped pages (origin: scrape).
 */
function collectFromScrape(scrapedData: ScrapedData[]): ProductImage[] {
  const seenUrls = new Set<string>();
  const images: ProductImage[] = [];
  let ordem = 0;

  const priorityOrder: ('marca' | 'ecommerce' | 'marketplace')[] = [
    'marca',
    'ecommerce',
    'marketplace',
  ];

  for (const tipo of priorityOrder) {
    const pages = scrapedData.filter((d) => d.tipo === tipo);

    for (const page of pages) {
      if (!page.imagens) continue;

      for (const url of page.imagens) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        if (isLikelySmallOrIrrelevant(url)) continue;

        images.push({
          url,
          source: page.url,
          origem: 'scrape',
          selecionada: false,
          ordem: ordem++,
        });
      }
    }
  }

  return images;
}

/**
 * Search for product images via Firecrawl/SearXNG.
 */
async function searchForImages(searchTerm: string): Promise<ProductImage[]> {
  try {
    const results = await firecrawlSearchImages(searchTerm, 15);
    return results.map((r, i) => ({
      url: r.url,
      source: r.source || 'Search',
      origem: 'searxng' as const,
      selecionada: false,
      ordem: i,
    }));
  } catch (error) {
    console.error('Image search failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Collect images from both sources, deduplicate, and merge.
 */
export async function collectImages(
  scrapedData: ScrapedData[],
  searchTerm?: string
): Promise<ProductImage[]> {
  const seenUrls = new Set<string>();
  const allImages: ProductImage[] = [];
  let ordem = 0;

  // 1. Image search (more relevant, product-focused)
  if (searchTerm) {
    const searchedImages = await searchForImages(searchTerm);
    for (const img of searchedImages) {
      if (seenUrls.has(img.url)) continue;
      seenUrls.add(img.url);
      allImages.push({ ...img, ordem: ordem++ });
    }
  }

  // 2. Scrape images (from Firecrawl pages)
  const scrapeImages = collectFromScrape(scrapedData);
  for (const img of scrapeImages) {
    if (seenUrls.has(img.url)) continue;
    seenUrls.add(img.url);
    allImages.push({ ...img, ordem: ordem++ });
  }

  return allImages;
}

/**
 * Heuristic to filter out small/irrelevant images.
 */
function isLikelySmallOrIrrelevant(url: string): boolean {
  const lower = url.toLowerCase();

  if (
    lower.includes('icon') || lower.includes('logo') ||
    lower.includes('favicon') || lower.includes('banner') ||
    lower.includes('sprite') || lower.includes('avatar') ||
    lower.includes('badge') || lower.includes('selo') ||
    lower.includes('frete') || lower.includes('shipping') ||
    lower.includes('payment') || lower.includes('flag') ||
    lower.includes('rating') || lower.includes('star') ||
    lower.includes('thumb') || lower.includes('cart') ||
    lower.includes('menu') || lower.includes('arrow') ||
    lower.includes('btn') || lower.includes('pixel') ||
    lower.includes('tracking') || lower.includes('analytics') ||
    lower.includes('placeholder')
  ) {
    return true;
  }

  const sizeMatch = lower.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const w = parseInt(sizeMatch[1], 10);
    const h = parseInt(sizeMatch[2], 10);
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) return true;
  }

  const smallPatterns = [
    /\/\d{1,2}x\d{1,2}\//,
    /[-_](\d{1,2})x(\d{1,2})\./,
    /[-_]thumb\./,
    /[-_]mini\./,
    /[-_]small\./,
    /[-_]tiny\./,
    /[-_]xs\./,
  ];

  for (const pattern of smallPatterns) {
    if (pattern.test(lower)) return true;
  }

  return false;
}
