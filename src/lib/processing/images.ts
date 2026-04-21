/**
 * Image extraction, search, and deduplication.
 *
 * Two sources:
 * - "scrape": extracted from pages scraped by Firecrawl
 * - "searxng": dedicated image search via searchImages()
 *
 * Aggressive filtering to only keep product-quality images (>= 300px).
 * Max 20 images total per product.
 */

import type { ScrapedData, ProductImage } from '@/lib/types';
import { searchImages as firecrawlSearchImages } from '@/lib/firecrawl';

const MIN_DIMENSION = 300;
const MAX_IMAGES = 20;

/**
 * Collect images from scraped pages (origin: scrape).
 */
function collectFromScrape(scrapedData: ScrapedData[]): ProductImage[] {
  const seenUrls = new Set<string>();
  const images: ProductImage[] = [];
  let ordem = 0;

  const priorityOrder: ('marca' | 'ecommerce' | 'marketplace' | 'concorrente')[] = [
    'marca',
    'ecommerce',
    'marketplace',
    'concorrente',
  ];

  for (const tipo of priorityOrder) {
    const pages = scrapedData.filter((d) => d.tipo === tipo);

    for (const page of pages) {
      if (!page.imagens) continue;

      for (const url of page.imagens) {
        if (seenUrls.has(url)) continue;
        seenUrls.add(url);

        if (isSmallOrIrrelevant(url)) continue;

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
    const images: ProductImage[] = [];

    for (const r of results) {
      if (isSmallOrIrrelevant(r.url)) continue;
      images.push({
        url: r.url,
        source: r.source || 'Search',
        origem: 'searxng' as const,
        selecionada: false,
        ordem: images.length,
      });
    }

    return images;
  } catch (error) {
    console.error('Image search failed:', error instanceof Error ? error.message : error);
    return [];
  }
}

/**
 * Collect images from both sources, deduplicate, filter, and limit.
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

  // Limit total images
  return allImages.slice(0, MAX_IMAGES);
}

/**
 * Aggressive filter for small/irrelevant images.
 */
function isSmallOrIrrelevant(url: string): boolean {
  const lower = url.toLowerCase();

  // === BLOCKED PATTERNS (non-product content) ===
  const blockedWords = [
    'icon', 'logo', 'favicon', 'banner', 'sprite', 'avatar',
    'badge', 'selo', 'frete', 'shipping', 'payment', 'flag',
    'rating', 'star', 'cart', 'menu', 'arrow', 'btn', 'button',
    'pixel', 'tracking', 'analytics', 'placeholder', 'widget',
    'step-', 'loader', 'spinner', 'barcode', 'qrcode', 'qr-code',
    'seller', 'brand/t_', // brand logos in CDNs
    '/shared/', // shared UI elements
    'line.jpg', // decorative lines
    'stamp_', 'ssl', 'encrypt', 'secure', 'verified',
    'social', 'facebook', 'instagram', 'twitter', 'youtube',
    'whatsapp', 'newsletter', 'subscribe', 'footer', 'header',
    'breadcrumb', 'navigation', 'search-', 'close-', 'zoom',
    '/static/img/struct/', // store framework UI elements
  ];

  for (const word of blockedWords) {
    if (lower.includes(word)) return true;
  }

  // === BLOCKED DOMAINS (non-product image sources) ===
  const blockedDomains = [
    'upcitemdb.com', // barcode images
    'cdn.aplazo.mx', // payment widget
    'wx.mlcdn.com.br/site/shared', // ML seller logos
  ];

  for (const domain of blockedDomains) {
    if (lower.includes(domain)) return true;
  }

  // === SIZE DETECTION: NxN format ===
  const sizeMatch = lower.match(/(\d+)x(\d+)/);
  if (sizeMatch) {
    const w = parseInt(sizeMatch[1], 10);
    const h = parseInt(sizeMatch[2], 10);
    if (w < MIN_DIMENSION || h < MIN_DIMENSION) return true;
  }

  // === SIZE DETECTION: Amazon-style suffixes ===
  // _SS40_, _SS115_, _US40_, _SY88_, _SX100_, _AC_US40_, etc.
  const amazonSizeMatch = lower.match(/[._](ss|us|sy|sx|sl)(\d+)[._]/i);
  if (amazonSizeMatch) {
    const size = parseInt(amazonSizeMatch[2], 10);
    if (size < MIN_DIMENSION) return true;
  }

  // _AC_SS115_, _AC_UC154,154_ etc.
  const amazonAcMatch = lower.match(/_ac_[a-z]{2}(\d+)/i);
  if (amazonAcMatch) {
    const size = parseInt(amazonAcMatch[1], 10);
    if (size < MIN_DIMENSION) return true;
  }

  // _AC_UF480,480_ — this is ok (480 > 300)
  // _AC_UL232_ — too small
  const amazonUlMatch = lower.match(/_ac_ul(\d+)/i);
  if (amazonUlMatch) {
    const size = parseInt(amazonUlMatch[1], 10);
    if (size < MIN_DIMENSION) return true;
  }

  // === AMAZON UI ICONS (no size suffix = likely small icon) ===
  // Pattern: /images/I/SHORTID.png (11 chars, no size suffix)
  const amazonIconMatch = lower.match(/\/images\/i\/([a-z0-9]+)\.(png|jpg)$/i);
  if (amazonIconMatch && amazonIconMatch[1].length <= 14 && !lower.includes('_ac_')) {
    return true; // Short Amazon ID without size = UI icon
  }

  // === SMALL PATTERNS ===
  const smallPatterns = [
    /\/\d{1,2}x\d{1,2}\//,        // /50x50/
    /[-_](\d{1,2})x(\d{1,2})\./,   // _50x50.
    /[-_]thumb\./i,
    /[-_]mini\./i,
    /[-_]small\./i,
    /[-_]tiny\./i,
    /[-_]xs\./i,
    /[-_]sm\./i,
    /_SS\d{1,2}\./i,               // _SS40.
    /\._SY\d{1,2}\./i,             // ._SY88.
  ];

  for (const pattern of smallPatterns) {
    if (pattern.test(lower)) return true;
  }

  // === FILE EXTENSION CHECK ===
  // Only allow common image formats
  const hasImageExt = /\.(jpg|jpeg|png|webp|gif|avif)(\?|$|#)/i.test(url);
  if (!hasImageExt) {
    // Check if it's a CDN URL that might not have extension
    const knownImageCdns = ['images-na.ssl-images-amazon.com', 'm.media-amazon.com', 'images.tcdn.com.br', 'cloudfront.net'];
    const isKnownCdn = knownImageCdns.some((cdn) => lower.includes(cdn));
    if (!isKnownCdn) return true; // Not a recognized image URL
  }

  return false;
}
