/**
 * Image extraction and deduplication from scraped data.
 */

import type { ScrapedData, ProductImage } from '@/lib/types';

/**
 * Collect and deduplicate images from scraped pages.
 * Prioritizes: brand > ecommerce > marketplace.
 */
export function collectImages(scrapedData: ScrapedData[]): ProductImage[] {
  const seenUrls = new Set<string>();
  const images: ProductImage[] = [];
  let ordem = 0;

  // Process in priority order
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
        // Skip duplicates
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        // Skip tiny images (icons, logos, etc.) based on URL heuristics
        if (isLikelySmallImage(url)) continue;

        images.push({
          url,
          source: page.url,
          selecionada: ordem < 5, // Auto-select first 5 images
          ordem: ordem++,
        });
      }
    }
  }

  return images;
}

/**
 * Heuristic to filter out likely small/irrelevant images.
 */
function isLikelySmallImage(url: string): boolean {
  const lower = url.toLowerCase();

  // Skip common icon/logo patterns
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
    lower.includes('flag')
  ) {
    return true;
  }

  // Check for explicit small size in URL
  const sizeMatch = lower.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const w = parseInt(sizeMatch[1], 10);
    const h = parseInt(sizeMatch[2], 10);
    if (w < 100 || h < 100) return true;
  }

  return false;
}
