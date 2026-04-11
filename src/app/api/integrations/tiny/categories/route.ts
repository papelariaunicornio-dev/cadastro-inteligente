import { NextResponse } from 'next/server';

interface TinyCategory {
  id: string;
  descricao: string;
  nodes: TinyCategory[];
}

interface TinyCategoriesResponse {
  retorno: {
    status_processamento: number;
    status: string;
    categorias?: TinyCategory[];
    erros?: { erro: string }[];
  };
}

interface FlatCategory {
  id: string;
  nome: string;
  path: string; // "Pai > Filho > Neto"
  level: number;
}

function flattenCategories(
  categories: TinyCategory[],
  parentPath = '',
  level = 0
): FlatCategory[] {
  const result: FlatCategory[] = [];

  for (const cat of categories) {
    const path = parentPath ? `${parentPath} > ${cat.descricao}` : cat.descricao;
    result.push({
      id: cat.id,
      nome: cat.descricao,
      path,
      level,
    });

    if (cat.nodes && cat.nodes.length > 0) {
      result.push(...flattenCategories(cat.nodes, path, level + 1));
    }
  }

  return result;
}

/**
 * Fetch product categories from Tiny ERP.
 * Returns a flat list with full path for easy selection.
 */
export async function GET() {
  const token = process.env.TINY_ERP_TOKEN;

  if (!token) {
    return NextResponse.json(
      { error: 'TINY_ERP_TOKEN not configured', categories: [] },
      { status: 200 }
    );
  }

  try {
    const formData = new URLSearchParams();
    formData.append('token', token);
    formData.append('formato', 'JSON');

    const res = await fetch(
      'https://api.tiny.com.br/api2/produtos.categorias.arvore.php',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: formData.toString(),
      }
    );

    const data = (await res.json()) as TinyCategoriesResponse;

    if (data.retorno.status !== 'OK' || !data.retorno.categorias) {
      const errors = data.retorno.erros?.map((e) => e.erro).join('; ');
      return NextResponse.json({
        error: errors || 'Erro ao buscar categorias',
        categories: [],
      });
    }

    const flat = flattenCategories(data.retorno.categorias);

    return NextResponse.json({
      categories: flat,
      total: flat.length,
    });
  } catch (error) {
    console.error('Tiny categories error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro de conexao', categories: [] });
  }
}
