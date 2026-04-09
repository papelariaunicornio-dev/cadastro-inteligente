/**
 * Firecrawl API client for web search and scraping.
 * Docs: https://docs.firecrawl.dev
 */

const FIRECRAWL_BASE = 'https://api.firecrawl.dev/v1';

function getApiKey(): string {
  const key = process.env.FIRECRAWL_API_KEY;
  if (!key) throw new Error('FIRECRAWL_API_KEY not set');
  return key;
}

async function firecrawlRequest<T>(
  path: string,
  body: Record<string, unknown>,
  retries = 3
): Promise<T> {
  const apiKey = getApiKey();

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const res = await fetch(`${FIRECRAWL_BASE}${path}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      if (res.status === 429) {
        // Rate limited — wait and retry
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
      console.warn(`Firecrawl error, retrying in ${waitMs}ms...`, error);
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

interface SearchResponse {
  success: boolean;
  data: FirecrawlSearchResult[];
}

export async function search(
  query: string,
  limit = 5
): Promise<FirecrawlSearchResult[]> {
  try {
    const result = await firecrawlRequest<SearchResponse>('/search', {
      query,
      limit,
    });
    return result.data || [];
  } catch (error) {
    console.error(`Firecrawl search failed for "${query}":`, error);
    return [];
  }
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
    console.error(`Firecrawl scrape failed for "${url}":`, error);
    return null;
  }
}
