/**
 * Classifies URLs into marca/ecommerce/marketplace categories.
 */

import { BRAND_DOMAINS } from './brand-mapper';
import type { UrlClassification } from '@/lib/types';

const MARKETPLACE_DOMAINS = new Set([
  'mercadolivre.com.br',
  'produto.mercadolivre.com.br',
  'amazon.com.br',
  'shopee.com.br',
  'magazineluiza.com.br',
  'magalu.com.br',
  'casasbahia.com.br',
  'americanas.com.br',
  'shoptime.com.br',
  'submarino.com.br',
  'aliexpress.com',
  'extra.com.br',
  'carrefour.com.br',
]);

const ECOMMERCE_DOMAINS = new Set([
  'kalunga.com.br',
  'papelariaunicornio.com.br',
  'lojadomecanico.com.br',
  'staples.com.br',
  'gimba.com.br',
  'officemax.com.br',
  'papelaria.net',
  'grafitti.com.br',
  'elo7.com.br',
  'shopee.com.br',
]);

function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, '');
    return hostname;
  } catch {
    return '';
  }
}

/**
 * Classify an array of URLs into brand/ecommerce/marketplace.
 */
export function classifyUrls(
  urls: string[],
  brandName?: string,
  competitorDomains?: string[]
): UrlClassification {
  const result: UrlClassification = {
    marca: [],
    ecommerce: [],
    marketplace: [],
    concorrente: [],
  };

  for (const url of urls) {
    const domain = extractDomain(url);
    if (!domain) continue;

    // Skip competitor domains — they are scraped separately via scrapeCompetitorPages
    if (competitorDomains?.some((cd) => domain.includes(cd) || cd.includes(domain))) {
      continue;
    }

    // Check if it's a known brand domain
    if (BRAND_DOMAINS[domain]) {
      result.marca.push(url);
      continue;
    }

    // Check if domain contains brand name (heuristic)
    if (brandName) {
      const brandLower = brandName.toLowerCase();
      if (domain.includes(brandLower)) {
        result.marca.push(url);
        continue;
      }
    }

    // Check marketplace
    if (MARKETPLACE_DOMAINS.has(domain)) {
      result.marketplace.push(url);
      continue;
    }

    // Check known e-commerce
    if (ECOMMERCE_DOMAINS.has(domain)) {
      result.ecommerce.push(url);
      continue;
    }

    // Default: if it looks like a product page, classify as e-commerce
    if (
      url.includes('/produto') ||
      url.includes('/product') ||
      url.includes('/p/') ||
      url.includes('/item/')
    ) {
      result.ecommerce.push(url);
      continue;
    }

    // Fallback: e-commerce
    result.ecommerce.push(url);
  }

  return result;
}
