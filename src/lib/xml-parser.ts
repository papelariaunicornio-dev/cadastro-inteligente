import { XMLParser } from 'fast-xml-parser';
import type { ParsedNF, ParsedItem } from './types';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  removeNSPrefix: true, // Remove namespace prefixes
});

/**
 * Parses unidade comercial string to extract units per item.
 * Examples: CX12 → 12, CX → 1, BL → 1, UN → 1, PC → 1, DP → 1, ES → 1, CR → 1
 */
function parseUnidadesPorItem(uCom: string): number {
  // Try to extract trailing number from unit code
  const match = uCom.match(/(\d+)$/);
  if (match) {
    return parseInt(match[1], 10);
  }
  return 1;
}

/**
 * Safely get a value from a nested object path.
 */
function safeGet(obj: Record<string, unknown>, ...keys: string[]): unknown {
  let current: unknown = obj;
  for (const key of keys) {
    if (current == null || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[key];
  }
  return current;
}

/**
 * Extract IPI value from item tax data.
 */
function extractIPI(imposto: Record<string, unknown>): number {
  const ipi = imposto?.IPI as Record<string, unknown> | undefined;
  if (!ipi) return 0;

  // Try IPITrib first
  const ipiTrib = ipi.IPITrib as Record<string, unknown> | undefined;
  if (ipiTrib?.vIPI != null) {
    return parseFloat(String(ipiTrib.vIPI));
  }

  // Try IPINT (IPI não tributado)
  return 0;
}

/**
 * Parse an NF-e XML string and extract header + items.
 */
export function parseNFeXML(xmlString: string): {
  nf: ParsedNF;
  items: ParsedItem[];
} {
  const parsed = parser.parse(xmlString);

  // Navigate to infNFe — handle both nfeProc>NFe>infNFe and procNFe>NFe>infNFe
  const nfeProc = parsed.nfeProc || parsed.procNFe;
  if (!nfeProc) {
    throw new Error('XML inválido: não encontrou nfeProc ou procNFe');
  }

  const nfe = nfeProc.NFe;
  if (!nfe) {
    throw new Error('XML inválido: não encontrou NFe');
  }

  const infNFe = nfe.infNFe;
  if (!infNFe) {
    throw new Error('XML inválido: não encontrou infNFe');
  }

  // Extract header
  const ide = infNFe.ide;
  const emit = infNFe.emit;
  const dest = infNFe.dest;
  const total = infNFe.total;

  // Chave de acesso: from @_Id attribute, strip "NFe" prefix
  const chaveAcesso = (infNFe['@_Id'] || '')
    .replace(/^NFe/, '');

  const nf: ParsedNF = {
    chaveAcesso,
    numeroNf: String(ide.nNF),
    dataEmissao: ide.dhEmi,
    fornecedor: {
      cnpj: emit.CNPJ || '',
      nome: emit.xNome || '',
      fantasia: emit.xFant || emit.xNome || '',
    },
    destinatario: {
      cnpj: dest.CNPJ || '',
      nome: dest.xNome || '',
    },
    valorTotal: parseFloat(
      String(
        safeGet(total as Record<string, unknown>, 'ICMSTot', 'vNF') || 0
      )
    ),
  };

  // Extract items — handle single item (not array) case
  let detArray = infNFe.det;
  if (!Array.isArray(detArray)) {
    detArray = detArray ? [detArray] : [];
  }

  const items: ParsedItem[] = detArray.map(
    (det: Record<string, unknown>) => {
      const prod = det.prod as Record<string, unknown>;
      const imposto = det.imposto as Record<string, unknown>;
      const nItem = parseInt(String(det['@_nItem']), 10);

      const eanRaw = String(prod.cEAN || '');
      const ean =
        eanRaw === 'SEM GTIN' || eanRaw === '' ? null : eanRaw;

      const uCom = String(prod.uCom || 'UN');
      const quantidade = parseFloat(String(prod.qCom || 0));
      const valorUnitario = parseFloat(String(prod.vUnCom || 0));
      const valorProduto = parseFloat(String(prod.vProd || 0));
      const valorIpi = extractIPI(imposto);

      return {
        nItem,
        codigo: String(prod.cProd || ''),
        ean,
        descricao: String(prod.xProd || ''),
        ncm: String(prod.NCM || ''),
        cfop: String(prod.CFOP || ''),
        unidadeComercial: uCom,
        quantidade,
        unidadesPorItem: parseUnidadesPorItem(uCom),
        valorUnitario,
        valorProduto,
        valorIpi,
        valorTotal: valorProduto + valorIpi,
      };
    }
  );

  return { nf, items };
}
