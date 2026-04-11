/**
 * AI content generation step: build prompt and call OpenAI to generate product draft.
 */

import { generateJSON, type GenerateResult } from '@/lib/openai';
import type { NfItem, ScrapedData, UserSettings, ItemClassification } from '@/lib/types';

interface GeneratedProduct {
  titulo: string;
  descricao_curta: string;
  descricao: string; // HTML
  marca: string;
  categoria: string;
  tags: string[];
  sku_sugerido: string;
  peso_estimado: number | null;
  dimensoes: {
    altura: number | null;
    largura: number | null;
    profundidade: number | null;
  };
  atributos: Record<string, string>;
  // SEO
  titulo_seo: string;
  descricao_seo: string;
  palavras_chave: string;
  // For com_variacao type
  tem_variacoes: boolean;
  tipo_variacao: string | null;
  variacoes: {
    nome: string;
    atributos: Record<string, string>;
  }[];
}

interface GenerateContext {
  items: NfItem[];
  tipo: ItemClassification;
  brand: string;
  scrapedData: ScrapedData[];
  settings: Partial<UserSettings> | null;
}

const SYSTEM_PROMPT = `Você é um especialista em cadastro de produtos para e-commerce brasileiro.
Sua tarefa é gerar um cadastro completo e profissional para um produto, baseado nos dados fornecidos.

REGRAS:
1. O título deve ser otimizado para SEO, claro e descritivo
2. A descrição deve ser em HTML válido, rica e persuasiva
3. A descrição curta deve ter no máximo 300 caracteres
4. Tags devem ser palavras-chave relevantes para busca
5. Se o produto tem variações, identifique o tipo (Cor, Tamanho, etc.)
6. Para SKU, use o formato: PREFIXO-MARCA3CHARS-SEQUENCIAL (ex: PU-PEN-001)
7. Responda SEMPRE em JSON válido conforme o schema solicitado
8. Use português brasileiro formal mas acessível`;

export async function generateProductDraft(
  ctx: GenerateContext
): Promise<GenerateResult<GeneratedProduct>> {
  const { items, tipo, brand, scrapedData, settings } = ctx;
  const primaryItem = items[0];

  // Build user prompt
  let userPrompt = `## Contexto da Loja\n`;
  if (settings) {
    userPrompt += `- Nome: ${settings.nome_loja || 'Loja Online'}\n`;
    userPrompt += `- Segmento: ${settings.segmento || 'Papelaria e escritório'}\n`;
    userPrompt += `- Público-alvo: ${settings.publico_alvo || 'Estudantes e profissionais'}\n`;
    userPrompt += `- Tom de voz: ${settings.tom_de_voz || 'Profissional e acessível'}\n`;
  }

  userPrompt += `\n## Produto a Cadastrar\n`;
  userPrompt += `- Nome na NF: ${primaryItem.descricao}\n`;
  userPrompt += `- Código do fornecedor: ${primaryItem.codigo}\n`;
  userPrompt += `- EAN: ${primaryItem.ean || 'N/A'}\n`;
  userPrompt += `- NCM: ${primaryItem.ncm}\n`;
  userPrompt += `- Marca: ${brand}\n`;
  userPrompt += `- Tipo de cadastro: ${tipo}\n`;

  if (tipo === 'multiplos_itens' && items.length > 1) {
    userPrompt += `\n### Itens do Grupo (cada um será uma variação):\n`;
    for (const item of items) {
      userPrompt += `- ${item.descricao} (EAN: ${item.ean || 'N/A'}, Código: ${item.codigo})\n`;
    }
  }

  if (tipo === 'com_variacao') {
    userPrompt += `\nEste produto é vendido em variações (ex: cores diferentes). `;
    userPrompt += `Pesquise nos dados coletados quais variações existem e liste-as.\n`;
  }

  // Add scraped data
  if (scrapedData.length > 0) {
    userPrompt += `\n## Dados Coletados na Web\n`;

    for (const data of scrapedData.slice(0, 5)) {
      userPrompt += `\n### ${data.tipo.toUpperCase()} — ${data.url}\n`;
      if (data.titulo) userPrompt += `Título: ${data.titulo}\n`;
      if (data.descricao) {
        const desc = data.descricao.substring(0, 500);
        userPrompt += `Descrição: ${desc}\n`;
      }
      if (data.especificacoes) {
        userPrompt += `Especificações:\n`;
        for (const [k, v] of Object.entries(data.especificacoes).slice(0, 10)) {
          userPrompt += `  - ${k}: ${v}\n`;
        }
      }
      if (data.preco) {
        userPrompt += `Preço: R$ ${data.preco.toFixed(2)}\n`;
      }
    }
  }

  // Title template
  const maxTitulo = settings?.tamanho_max_titulo || 150;
  userPrompt += `\n## Regras de Conteúdo\n`;
  userPrompt += `- Título: máximo ${maxTitulo} caracteres\n`;
  if (settings?.template_titulo) {
    userPrompt += `- Template de título: ${settings.template_titulo}\n`;
  }
  if (settings?.instrucoes_descricao) {
    userPrompt += `- Instruções para descrição: ${settings.instrucoes_descricao}\n`;
  }
  userPrompt += `- Incluir especificações técnicas: ${settings?.incluir_specs !== false ? 'Sim' : 'Não'}\n`;

  // SKU
  const prefixo = settings?.prefixo_sku || 'PU';
  userPrompt += `- Prefixo SKU: ${prefixo}\n`;

  userPrompt += `\n## Formato de Saída (JSON)\n`;
  userPrompt += `Retorne um JSON com exatamente esta estrutura:\n`;
  userPrompt += `{
  "titulo": "string (max ${maxTitulo} chars)",
  "descricao_curta": "string (max 300 chars)",
  "descricao": "string (HTML válido com tags p, ul, li, strong, h3)",
  "marca": "string",
  "categoria": "string",
  "tags": ["string"],
  "sku_sugerido": "string (formato: ${prefixo}-XXX-000)",
  "peso_estimado": number ou null (em kg),
  "dimensoes": {"altura": number|null, "largura": number|null, "profundidade": number|null},
  "atributos": {"chave": "valor"},
  "titulo_seo": "string (max 70 chars, otimizado para Google)",
  "descricao_seo": "string (max 160 chars, meta description persuasiva)",
  "palavras_chave": "string (palavras-chave separadas por vírgula, para SEO)",
  "tem_variacoes": boolean,
  "tipo_variacao": "string ou null (ex: Cor, Tamanho)",
  "variacoes": [{"nome": "string", "atributos": {"chave": "valor"}}]
}`;

  return generateJSON<GeneratedProduct>(SYSTEM_PROMPT, userPrompt);
}
