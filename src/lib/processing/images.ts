/**
 * Image extraction, search, and deduplication.
 *
 * Two sources:
 * - "scrape": extracted from pages scraped by Firecrawl (filtered by URL heuristics, min 300px)
 * - "searxng": dedicated image search via SearXNG (more relevant, product-focused)
 *
 * Each image is tagged with its origin for the user to evaluate quality.
 */

import type { ScrapedData, ProductImage } from '@/lib/types';
import { search as searxSearch } from '@/lib/firecrawl';

const MIN_DIMENSION = 300; // Minimum 300px in any dimension

/**
 * Collect images from scraped pages (origin: scrape).
 * Filters out small/irrelevant images by URL heuristics.
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
 * Search for product images via SearXNG (origin: searxng).
 */
async function searchImages(searchTerm: string): Promise<ProductImage[]> {
  try {
    const searxngBase = process.env.SEARXNG_URL || 'http://searxng:8080';

    const params = new URLSearchParams({
      q: searchTerm,
      format: 'json',
      categories: 'images',
      language: 'pt-BR',
    });

    const res = await fetch(`${searxngBase}/search?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) return [];

    const data = await res.json();
    const results: ProductImage[] = [];

    for (const r of (data.results || []).slice(0, 15)) {
      const imgUrl = r.img_src || r.url;
      if (!imgUrl || !imgUrl.startsWith('http')) continue;

      // Filter by resolution if SearXNG provides it
      const w = r.img_width || r.resolution?.width;
      const h = r.img_height || r.resolution?.height;
      if (w && h && (w < MIN_DIMENSION || h < MIN_DIMENSION)) continue;

      results.push({
        url: imgUrl,
        thumbnail: r.thumbnail_src || r.thumbnail,
        width: w || undefined,
        height: h || undefined,
        source: r.source || r.url || 'SearXNG',
        origem: 'searxng',
        selecionada: false,
        ordem: results.length,
      });
    }

    return results;
  } catch (error) {
    console.error('SearXNG image search failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Collect images from both sources, deduplicate, and merge.
 * SearXNG images come first (more relevant), then scrape images.
 */
export async function collectImages(
  scrapedData: ScrapedData[],
  searchTerm?: string
): Promise<ProductImage[]> {
  const seenUrls = new Set<string>();
  const allImages: ProductImage[] = [];
  let ordem = 0;

  // 1. SearXNG image search (if we have a search term)
  if (searchTerm) {
    const searxImages = await searchImages(searchTerm);
    for (const img of searxImages) {
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
 * Heuristic to filter out small/irrelevant images from URLs.
 */
function isLikelySmallOrIrrelevant(url: string): boolean {
  const lower = url.toLowerCase();

  // Skip common non-product patterns
  if (
    lower.includes('icon') ||
    lower.includes('logo') ||
    lower.includes('favicon') ||
    lower.includes('banner') ||
    lower.includes('sprite') ||
    lower.includes('avatar') ||
    lower.includes('badge') ||
    lower.includes('selo') ||
    lower.includes('frete') ||
    lower.includes('shipping') ||
    lower.includes('payment') ||
    lower.includes('flag') ||
    lower.includes('rating') ||
    lower.includes('star') ||
    lower.includes('thumb') ||
    lower.includes('cart') ||
    lower.includes('menu') ||
    lower.includes('arrow') ||
    lower.includes('btn') ||
    lower.includes('pixel') ||
    lower.includes('tracking') ||
    lower.includes('analytics') ||
    lower.includes('placeholder')
  ) {
    return true;
  }

  // Check for explicit size in URL — reject if < 300px
  const sizeMatch = lower.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const w = parseInt(sizeMatch[1], 10);
    const h = parseInt(sizeMatch[2], 10);
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) return true;
  }

  // Check for explicit small size indicators
  const smallPatterns = [
    /\/\d{1,2}x\d{1,2}\//,       // /50x50/
    /[-_](\d{1,2})x(\d{1,2})\./,  // _50x50.
    /[-_]thumb\./,
    /[-_]mini\./,
    /[-_]small\./,
    /[-_]tiny\./,
    /[-_]xs\./,
    /\/s\//, // Google small image
  ];

  for (const pattern of smallPatterns) {
    if (pattern.test(lower)) return true;
  }

  return false;
}
