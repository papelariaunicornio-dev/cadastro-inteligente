/**
 * Maps supplier CNPJ to supplier/distributor name.
 * NOTE: The supplier is NOT necessarily the product brand.
 * E.g., IMEX distributes many brands, Sertic distributes CIS/Uni-ball/Molin.
 * The actual brand is identified by the AI from the product name + scraped data.
 *
 * This mapping is used for:
 * - Search queries (helps find the right products)
 * - URL classification (identify brand websites)
 * - Fallback when AI can't determine the brand
 */

const CNPJ_TO_SUPPLIER: Record<string, string> = {
  '01148183000150': 'Molin',
  '60840691000163': 'CIS/Sertic',
  '61611141000135': 'Pentel',
  '24878509000108': 'Artistik',
  '49870081000170': 'Ciceros',
};

/**
 * Identify supplier/distributor from CNPJ or name.
 * Used as a search hint, NOT as the definitive brand.
 */
export function identifyBrand(
  cnpj: string,
  supplierName: string,
  supplierFantasia?: string
): string {
  const cleanCnpj = cnpj.replace(/\D/g, '');

  if (CNPJ_TO_SUPPLIER[cleanCnpj]) {
    return CNPJ_TO_SUPPLIER[cleanCnpj];
  }

  if (supplierFantasia) {
    const fantasia = supplierFantasia.trim();
    if (fantasia.length > 0 && fantasia.length < 30) {
      return fantasia;
    }
  }

  const name = supplierName
    .replace(/\b(LTDA|EPP|ME|EIRELI|SA|S\.A\.|S\/A|COMERCIO|COMERCIAL|IMPORTACAO|EXPORTACAO|INDUSTRIA|DISTRIBUIDORA|COML)\b/gi, '')
    .trim();

  const firstWord = name.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return 'Desconhecido';
}

/**
 * Known brand website domains for URL classification.
 */
export const BRAND_DOMAINS: Record<string, string> = {
  'molin.com.br': 'Molin',
  'cis.com.br': 'CIS',
  'pentel.com.br': 'Pentel',
  'artistik.com.br': 'Artistik',
  'ciceros.com.br': 'Ciceros',
  'faber-castell.com.br': 'Faber-Castell',
  'bic.com.br': 'BIC',
  'pilot.com.br': 'Pilot',
  'stabilo.com.br': 'Stabilo',
  'tilibra.com.br': 'Tilibra',
  'foroni.com.br': 'Foroni',
  'papermate.com.br': 'Paper Mate',
  'staedtler.com.br': 'Staedtler',
  'compactor.com.br': 'Compactor',
  'acrilex.com.br': 'Acrilex',
};
