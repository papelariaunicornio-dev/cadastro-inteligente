/**
 * Firecrawl + SearXNG client for web search and scraping.
 *
 * Architecture:
 * - Scrape: Firecrawl self-hosted (trieve/firecrawl on Coolify)
 * - Search: SearXNG self-hosted (searxng on Coolify, same network)
 *
 * Uses FIRECRAWL_BASE_URL env var to point to self-hosted instance.
 * Falls back to cloud API if FIRECRAWL_API_KEY is set but no base URL.
 */

function getFirecrawlBase(): string {
  // Self-hosted (preferred) — internal Coolify network or HTTPS domain
  if (process.env.FIRECRAWL_BASE_URL) {
    return process.env.FIRECRAWL_BASE_URL.replace(/\/$/, '');
  }
  // Cloud fallback
  return 'https://api.firecrawl.dev/v1';
}

function getSearxngBase(): string {
  // SearXNG self-hosted (same Coolify service network)
  return process.env.SEARXNG_URL || 'http://searxng:8080';
}

function getApiKey(): string {
  return process.env.FIRECRAWL_API_KEY || 'fc-self-hosted';
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
        console.warn(`Firecrawl rate limited, waiting ${waitMs}ms (attempt ${attempt}/${retries})`);
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
// Search (via SearXNG self-hosted)
// ==========================================

export interface FirecrawlSearchResult {
  url: string;
  title?: string;
  description?: string;
}

/**
 * Search using SearXNG self-hosted instance.
 * SearXNG provides web search without API keys or credits.
 */
export async function search(
  query: string,
  limit = 5
): Promise<FirecrawlSearchResult[]> {
  const searxngBase = getSearxngBase();

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      categories: 'general',
      language: 'pt-BR',
    });

    const res = await fetch(`${searxngBase}/search?${params}`, {
      headers: { Accept: 'application/json' },
    });

    if (!res.ok) {
      throw new Error(`SearXNG ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    const results: FirecrawlSearchResult[] = (data.results || [])
      .slice(0, limit)
      .map((r: { url: string; title?: string; content?: string }) => ({
        url: r.url,
        title: r.title,
        description: r.content,
      }));

    return results;
  } catch (error) {
    console.error(`SearXNG search failed for "${query}":`, error instanceof Error ? error.message : error);
    return [];
  }
}

// ==========================================
// Scrape (via Firecrawl self-hosted)
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

export async function scrape(
  url: string
): Promise<FirecrawlScrapeData | null> {
  try {
    const result = await firecrawlRequest<ScrapeResponse>('/scrape', {
      url,
      formats: ['markdown'],
    });
    return result.data || null;
  } catch (error) {
    console.error(`Firecrawl scrape failed for "${url}":`, error instanceof Error ? error.message : error);
    return null;
  }
}
