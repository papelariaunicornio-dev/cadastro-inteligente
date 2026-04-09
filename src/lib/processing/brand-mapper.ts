/**
 * Maps supplier CNPJ to brand name.
 * Expands over time as more suppliers are imported.
 */

const CNPJ_TO_BRAND: Record<string, string> = {
  '01148183000150': 'Molin',
  '60840691000163': 'CIS',
  '61611141000135': 'Pentel',
  '24878509000108': 'Artistik',
  '49870081000170': 'Ciceros',
};

/**
 * Try to identify brand from supplier CNPJ or name.
 */
export function identifyBrand(
  cnpj: string,
  supplierName: string,
  supplierFantasia?: string
): string {
  // Clean CNPJ (remove formatting)
  const cleanCnpj = cnpj.replace(/\D/g, '');

  // Try exact CNPJ match
  if (CNPJ_TO_BRAND[cleanCnpj]) {
    return CNPJ_TO_BRAND[cleanCnpj];
  }

  // Try fantasia name
  if (supplierFantasia) {
    const fantasia = supplierFantasia.trim();
    if (fantasia.length > 0 && fantasia.length < 30) {
      return fantasia;
    }
  }

  // Extract first meaningful word from supplier name
  const name = supplierName
    .replace(/\b(LTDA|EPP|ME|EIRELI|SA|S\.A\.|S\/A|COMERCIO|COMERCIAL|IMPORTACAO|EXPORTACAO|INDUSTRIA|DISTRIBUIDORA|COML)\b/gi, '')
    .trim();

  const firstWord = name.split(/\s+/)[0];
  if (firstWord && firstWord.length >= 3) {
    // Title case
    return firstWord.charAt(0).toUpperCase() + firstWord.slice(1).toLowerCase();
  }

  return 'Marca Desconhecida';
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
};
