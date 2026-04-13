/**
 * Web search and scraping client.
 *
 * Search: Firecrawl cloud /search (reliable)
 * Scrape: Firecrawl cloud /scrape
 * Images: SearXNG local (same docker network) → Bing Images fallback
 */

const FIRECRAWL_CLOUD = 'https://api.firecrawl.dev/v1';

function getFirecrawlBase(): string {
  return process.env.FIRECRAWL_BASE_URL?.replace(/\/$/, '') || FIRECRAWL_CLOUD;
}

function getApiKey(): string {
  return process.env.FIRECRAWL_API_KEY || '';
}

function getSearxngBase(): string | null {
  return process.env.SEARXNG_URL || null;
}

async function firecrawlRequest<T>(
  path: string,
  body: Record<string, unknown>,
  retries = 3
): Promise<T> {
  const base = getFirecrawlBase();
  const apiKey = getApiKey();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${base}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        const waitMs = Math.min(2000 * Math.pow(2, attempt - 1), 30000);
        console.warn(`Firecrawl rate limited, waiting ${waitMs}ms`);
        await new Promise((r) => setTimeout(r, waitMs));
        continue;
      }

      if (!res.ok) {
        const text = await res.text();
        throw new Error(`Firecrawl ${res.status}: ${text}`);
      }

      return (await res.json()) as T;
    } catch (error) {
      if (attempt === retries) throw error;
      const waitMs = 1000 * Math.pow(2, attempt - 1);
      console.warn(`Firecrawl error, retrying in ${waitMs}ms...`);
      await new Promise((r) => setTimeout(r, waitMs));
    }
  }

  throw new Error('Firecrawl: max retries exceeded');
}

// ==========================================
// Search
// ==========================================

export interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
}

interface FirecrawlSearchResponse {
  success: boolean;
  data: FirecrawlSearchResult[];
}

export async function search(
  query: string,
  limit = 5
): Promise<FirecrawlSearchResult[]> {
  // Firecrawl cloud search
  try {
    const result = await firecrawlRequest<FirecrawlSearchResponse>('/search', {
      query,
      limit,
    });
    if (result.data && result.data.length > 0) {
      return result.data;
    }
  } catch (error) {
    console.warn('Firecrawl search failed:', error instanceof Error ? error.message : error);
  }

  // Fallback: SearXNG web search
  const searxngBase = getSearxngBase();
  if (searxngBase) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories: 'general',
        language: 'pt-BR',
      });
      const res = await fetch(`${searxngBase}/search?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10000),
      });
      if (res.ok) {
        const data = await res.json();
        return (data.results || [])
          .slice(0, limit)
          .map((r: { url: string; title?: string; content?: string }) => ({
            url: r.url,
            title: r.title,
            description: r.content,
          }));
      }
    } catch {
      console.warn('SearXNG web search also unavailable');
    }
  }

  return [];
}

// ==========================================
// Scrape
// ==========================================

export interface FirecrawlScrapeData {
  markdown?: string;
  html?: string;
  metadata?: {
    title?: string;
    description?: string;
    ogImage?: string;
    [key: string]: unknown;
  };
  links?: string[];
}

interface ScrapeResponse {
  success: boolean;
  data: FirecrawlScrapeData;
}

export async function scrape(url: string): Promise<FirecrawlScrapeData | null> {
  try {
    const result = await firecrawlRequest<ScrapeResponse>('/scrape', {
      url,
      formats: ['markdown'],
    });
    return result.data || null;
  } catch (error) {
    console.error(`Scrape failed for "${url}":`, error instanceof Error ? error.message : error);
    return null;
  }
}

// ==========================================
// Image Search
// ==========================================

export interface ImageSearchResult {
  url: string;
  source: string;
  title?: string;
}

/**
 * Image filter: skip small, irrelevant, and non-product images.
 */
function isGoodImage(imgUrl: string): boolean {
  if (/icon|logo|favicon|sprite|banner|pixel|tracking|widget|barcode|seller|button|stamp|ssl|encrypt/i.test(imgUrl)) return false;
  if (/bing\.com|r\.bing\.com|microsoft\.com/i.test(imgUrl)) return false;

  const sizeMatch = imgUrl.match(/(\d+)x(\d+)/);
  if (sizeMatch && (parseInt(sizeMatch[1]) < 300 || parseInt(sizeMatch[2]) < 300)) return false;

  const amzSize = imgUrl.match(/[._](SS|US|SY|SX|SL|UL)(\d+)/i);
  if (amzSize && parseInt(amzSize[2]) < 300) return false;

  const amzAc = imgUrl.match(/_AC_[A-Z]{2}(\d+)/i);
  if (amzAc && parseInt(amzAc[1]) < 300) return false;

  return true;
}

/**
 * Extract image URLs from markdown content.
 */
function extractImageUrls(markdown: string): string[] {
  return (
    markdown.match(
      /https?:\/\/[^\s)"']+\.(?:jpg|jpeg|png|webp)(?:\?[^\s)"']*)?/gi
    ) || []
  );
}

/**
 * Search for product images.
 * 1. SearXNG local (same docker, fast, free, real image search)
 * 2. Bing Images via Firecrawl scrape (fallback)
 */
export async function searchImages(
  query: string,
  limit = 20
): Promise<ImageSearchResult[]> {
  const results: ImageSearchResult[] = [];
  const seenUrls = new Set<string>();

  // 1. SearXNG image search (same docker network, JSON enabled)
  const searxngBase = getSearxngBase();
  if (searxngBase) {
    try {
      const params = new URLSearchParams({
        q: query,
        format: 'json',
        categories: 'images',
        language: 'pt-BR',
      });
      const res = await fetch(`${searxngBase}/search?${params}`, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(15000),
      });
      if (res.ok) {
        const data = await res.json();
        for (const r of (data.results || []).slice(0, limit)) {
          const imgUrl = r.img_src || r.url;
          if (!imgUrl?.startsWith('http') || seenUrls.has(imgUrl)) continue;
          if (!isGoodImage(imgUrl)) continue;
          seenUrls.add(imgUrl);
          results.push({
            url: imgUrl,
            source: r.source || 'SearXNG',
            title: r.title,
          });
        }
        if (results.length > 0) {
          console.log(`[Images] SearXNG returned ${results.length} images`);
          return results.slice(0, limit);
        }
      }
    } catch (error) {
      console.warn('[Images] SearXNG failed:', error instanceof Error ? error.message : error);
    }
  }

  // 2. Bing Images via Firecrawl scrape (fallback)
  try {
    const bingUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
    const scraped = await scrape(bingUrl);

    if (scraped?.markdown) {
      for (const imgUrl of extractImageUrls(scraped.markdown)) {
        if (seenUrls.has(imgUrl)) continue;
        if (!isGoodImage(imgUrl)) continue;
        seenUrls.add(imgUrl);
        results.push({
          url: imgUrl,
          source: 'Bing Images',
          title: query,
        });
      }
      console.log(`[Images] Bing returned ${results.length} images`);
    }
  } catch (error) {
    console.error('[Images] Bing fallback failed:', error instanceof Error ? error.message : error);
  }

  return results.slice(0, limit);
}
