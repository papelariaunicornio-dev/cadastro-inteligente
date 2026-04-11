/**
 * Search step: find web pages about a product using Firecrawl.
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
}

export interface SearchResult {
  brand: string;
  allUrls: string[];
  classified: UrlClassification;
  rawResults: FirecrawlSearchResult[];
  firecrawlCredits: number; // Number of search API calls made
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

  // 1. Search by EAN (most specific)
  if (primaryItem.ean) {
    queries.push(`"${primaryItem.ean}"`);
  }

  // 2. Search by brand + product name
  const cleanName = primaryItem.descricao
    .replace(/\bCX\s*C\/\d+\b/gi, '')  // Remove "CX C/12"
    .replace(/\bBL\s*C\/\d+\b/gi, '')  // Remove "BL C/1"
    .replace(/\bDP\s*C?\/?\d*\b/gi, '') // Remove "DP 12"
    .replace(/\b(UN|PC|CR|ES)\b/gi, '') // Remove unit codes
    .trim();
  queries.push(`${brand} ${cleanName}`);

  // 3. If we have multiple items (group), search the common name
  if (ctx.items.length > 1) {
    // Find common prefix among item descriptions
    const commonName = findCommonPrefix(
      ctx.items.map((i) => i.descricao)
    );
    if (commonName.length > 5) {
      queries.push(`${brand} ${commonName}`);
    }
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
    // Small delay between searches
    await new Promise((r) => setTimeout(r, 500));
  }

  const allUrls = allResults.map((r) => r.url);
  const classified = classifyUrls(allUrls, brand);

  return {
    brand,
    allUrls,
    classified,
    rawResults: allResults,
    firecrawlCredits: queries.length, // Each search = 1 credit
  };
}

/**
 * Find common prefix among multiple strings.
 */
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
