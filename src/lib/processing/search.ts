/**
 * Search step: find web pages about a product using Firecrawl.
 * Includes competitor/reference sites from user settings.
 */

import { search, type FirecrawlSearchResult } from '@/lib/firecrawl';
import { identifyBrand } from './brand-mapper';
import { classifyUrls } from './classify-urls';
import type { NfItem, UrlClassification } from '@/lib/types';

interface SearchContext {
  items: NfItem[];
  fornecedorCnpj: string;
  fornecedorNome: string;
  fornecedorFantasia?: string;
  sitesConcorrentes?: { url: string; nome: string }[];
}

export interface SearchResult {
  brand: string;
  allUrls: string[];
  classified: UrlClassification;
  rawResults: FirecrawlSearchResult[];
  firecrawlCredits: number;
}

/**
 * Execute multiple search queries for a product and classify results.
 */
export async function searchProduct(ctx: SearchContext): Promise<SearchResult> {
  const primaryItem = ctx.items[0];
  const brand = identifyBrand(
    ctx.fornecedorCnpj,
    ctx.fornecedorNome,
    ctx.fornecedorFantasia
  );

  // Build search queries
  const queries: string[] = [];

  // Clean product name
  const cleanName = primaryItem.descricao
    .replace(/\bCX\s*C\/\d+\b/gi, '')
    .replace(/\bBL\s*C\/\d+\b/gi, '')
    .replace(/\bDP\s*C?\/?\d*\b/gi, '')
    .replace(/\b(UN|PC|CR|ES)\b/gi, '')
    .trim();

  // 1. Search by EAN (most specific)
  if (primaryItem.ean) {
    queries.push(`"${primaryItem.ean}"`);
  }

  // 2. Search by brand + product name
  queries.push(`${brand} ${cleanName}`);

  // 3. If multiple items (group), search the common name
  if (ctx.items.length > 1) {
    const commonName = findCommonPrefix(ctx.items.map((i) => i.descricao));
    if (commonName.length > 5) {
      queries.push(`${brand} ${commonName}`);
    }
  }

  // 4. Search specifically on competitor/reference sites
  if (ctx.sitesConcorrentes && ctx.sitesConcorrentes.length > 0) {
    const siteFilter = ctx.sitesConcorrentes
      .map((s) => {
        try {
          return new URL(s.url).hostname.replace('www.', '');
        } catch {
          return s.url.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0];
        }
      })
      .map((domain) => `site:${domain}`)
      .join(' OR ');

    queries.push(`${cleanName} ${siteFilter}`);
  }

  // Execute searches (sequential to respect rate limits)
  const allResults: FirecrawlSearchResult[] = [];
  const seenUrls = new Set<string>();

  for (const query of queries) {
    const results = await search(query, 5);
    for (const r of results) {
      if (!seenUrls.has(r.url)) {
        seenUrls.add(r.url);
        allResults.push(r);
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }

  const allUrls = allResults.map((r) => r.url);

  // Add competitor domains to classify-urls known lists
  const competitorDomains = (ctx.sitesConcorrentes || []).map((s) => {
    try {
      return new URL(s.url).hostname.replace('www.', '');
    } catch {
      return s.url.replace(/^https?:\/\//, '').replace('www.', '').split('/')[0];
    }
  });

  const classified = classifyUrls(allUrls, brand, competitorDomains);

  return {
    brand,
    allUrls,
    classified,
    rawResults: allResults,
    firecrawlCredits: queries.length,
  };
}

function findCommonPrefix(strings: string[]): string {
  if (strings.length === 0) return '';
  if (strings.length === 1) return strings[0];

  const words = strings.map((s) => s.split(/\s+/));
  const commonWords: string[] = [];

  for (let i = 0; i < words[0].length; i++) {
    const word = words[0][i];
    if (words.every((w) => w[i]?.toUpperCase() === word.toUpperCase())) {
      commonWords.push(word);
    } else {
      break;
    }
  }

  return commonWords.join(' ');
}
