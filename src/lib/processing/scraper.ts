/**
 * Scrape step: extract product data from web pages using Firecrawl.
 */

import { scrape } from '@/lib/firecrawl';
import type { UrlClassification, ScrapedData } from '@/lib/types';

/**
 * Scrape the top N pages from each category.
 */
export async function scrapePages(
  classified: UrlClassification,
  maxPerCategory = 3
): Promise<ScrapedData[]> {
  const results: ScrapedData[] = [];

  const tasks: { url: string; tipo: 'marca' | 'ecommerce' | 'marketplace' }[] = [];

  // Prioritize: brand pages first, then ecommerce, then marketplace
  for (const url of classified.marca.slice(0, maxPerCategory)) {
    tasks.push({ url, tipo: 'marca' });
  }
  for (const url of classified.ecommerce.slice(0, maxPerCategory)) {
    tasks.push({ url, tipo: 'ecommerce' });
  }
  for (const url of classified.marketplace.slice(0, maxPerCategory)) {
    tasks.push({ url, tipo: 'marketplace' });
  }

  // Scrape sequentially to respect rate limits
  for (const task of tasks) {
    try {
      const data = await scrape(task.url);
      if (!data) continue;

      const scraped = extractProductData(data.markdown || '', task.url, task.tipo);
      if (scraped) {
        results.push(scraped);
      }

      // Delay between scrapes
      await new Promise((r) => setTimeout(r, 1000));
    } catch (error) {
      console.error(`Scrape failed for ${task.url}:`, error);
    }
  }

  return results;
}

/**
 * Extract structured product data from scraped markdown content.
 */
function extractProductData(
  markdown: string,
  url: string,
  tipo: 'marca' | 'ecommerce' | 'marketplace'
): ScrapedData | null {
  if (!markdown || markdown.length < 50) return null;

  // Extract title (first heading)
  const titleMatch = markdown.match(/^#\s+(.+)$/m);
  const titulo = titleMatch?.[1]?.trim();

  // Extract price patterns (R$ XX,XX or R$ XX.XXX,XX)
  const priceMatches = markdown.match(
    /R\$\s*([\d.]+,\d{2})/g
  );
  let preco: number | undefined;
  if (priceMatches && priceMatches.length > 0) {
    // Take the first price that looks reasonable (not shipping, etc.)
    for (const priceStr of priceMatches) {
      const cleaned = priceStr
        .replace('R$', '')
        .replace(/\s/g, '')
        .replace('.', '')
        .replace(',', '.');
      const value = parseFloat(cleaned);
      if (value > 0.5 && value < 50000) {
        preco = value;
        break;
      }
    }
  }

  // Extract description (first paragraph after title, or first long text block)
  let descricao: string | undefined;
  const paragraphs = markdown
    .split('\n\n')
    .map((p) => p.trim())
    .filter((p) => p.length > 30 && !p.startsWith('#') && !p.startsWith('|'));
  if (paragraphs.length > 0) {
    descricao = paragraphs.slice(0, 3).join('\n\n');
    if (descricao.length > 2000) {
      descricao = descricao.substring(0, 2000);
    }
  }

  // Extract specs (look for key: value patterns or table rows)
  const especificacoes: Record<string, string> = {};
  const specPatterns = markdown.matchAll(
    /\*\*(.+?)\*\*:\s*(.+?)(?:\n|$)/g
  );
  for (const match of specPatterns) {
    const key = match[1].trim();
    const value = match[2].trim();
    if (key.length < 50 && value.length < 200) {
      especificacoes[key] = value;
    }
  }

  // Extract image URLs from markdown
  const imageUrls: string[] = [];
  const imgPatterns = markdown.matchAll(
    /!\[.*?\]\((https?:\/\/[^\s)]+(?:\.jpg|\.jpeg|\.png|\.webp)[^\s)]*)\)/gi
  );
  for (const match of imgPatterns) {
    imageUrls.push(match[1]);
  }

  // Also try to find image URLs in plain text
  const plainImgPatterns = markdown.matchAll(
    /(https?:\/\/[^\s"'<>]+(?:\.jpg|\.jpeg|\.png|\.webp)(?:\?[^\s"'<>]*)?)/gi
  );
  for (const match of plainImgPatterns) {
    if (!imageUrls.includes(match[1])) {
      imageUrls.push(match[1]);
    }
  }

  return {
    url,
    tipo,
    titulo,
    descricao,
    especificacoes: Object.keys(especificacoes).length > 0 ? especificacoes : undefined,
    preco,
    imagens: imageUrls.length > 0 ? imageUrls : undefined,
  };
}
