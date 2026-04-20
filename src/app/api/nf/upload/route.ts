import { NextRequest, NextResponse } from 'next/server';
import { parseNFeXML } from '@/lib/xml-parser';
import { create, bulkCreate, list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { NfImport, NfItem } from '@/lib/types';
import { requireAuth } from '@/lib/session';

export async function POST(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  try {
    const formData = await request.formData();
    const file = formData.get('xml') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Nenhum arquivo XML enviado' },
        { status: 400 }
      );
    }

    // Security: limit file size (5MB max for NF-e XML)
    const MAX_XML_SIZE = 5 * 1024 * 1024;
    if (file.size > MAX_XML_SIZE) {
      return NextResponse.json(
        { error: `Arquivo XML muito grande (${(file.size / 1024 / 1024).toFixed(1)}MB). Máximo: 5MB` },
        { status: 400 }
      );
    }

    // Security: validate file type
    if (!file.name.endsWith('.xml')) {
      return NextResponse.json(
        { error: 'Apenas arquivos .xml são aceitos' },
        { status: 400 }
      );
    }

    const xmlString = await file.text();

    // Parse XML
    const { nf, items } = parseNFeXML(xmlString);

    // Create NF import record
    const now = new Date().toISOString();
    const nfImport = await create<NfImport>(TABLES.NF_IMPORTS, {
      user_id: auth.user.id,
      chave_acesso: nf.chaveAcesso,
      numero_nf: nf.numeroNf,
      data_emissao: nf.dataEmissao,
      fornecedor_cnpj: nf.fornecedor.cnpj,
      fornecedor_nome: nf.fornecedor.nome,
      fornecedor_fantasia: nf.fornecedor.fantasia,
      destinatario_cnpj: nf.destinatario.cnpj,
      destinatario_nome: nf.destinatario.nome,
      valor_total: nf.valorTotal,
      xml_original: xmlString,
      created_at: now,
    });

    // Create NF items (bulk) — with rollback on failure
    let nfItems: NfItem[];
    try {
      nfItems = await bulkCreate<NfItem>(
      TABLES.NF_ITEMS,
      items.map((item) => ({
        nf_import_id: String(nfImport.Id),
        n_item: item.nItem,
        codigo: item.codigo,
        ean: item.ean,
        descricao: item.descricao,
        ncm: item.ncm,
        cfop: item.cfop,
        unidade_comercial: item.unidadeComercial,
        quantidade: item.quantidade,
        unidades_por_item: item.unidadesPorItem,
        valor_unitario: item.valorUnitario,
        valor_produto: item.valorProduto,
        valor_ipi: item.valorIpi,
        classificacao: null,
        grupo_id: null,
        selecionado: false,
        created_at: now,
      }))
      );
    } catch (bulkError) {
      // Rollback: delete the NF import if items failed
      console.error('Bulk create failed, rolling back NF import:', bulkError);
      const { remove } = await import('@/lib/nocodb');
      await remove(TABLES.NF_IMPORTS, nfImport.Id).catch(() => {});
      throw bulkError;
    }

    // Fetch the actual items back from NocoDB (bulkCreate only returns IDs)
    const { list: listFn } = await import('@/lib/nocodb');
    const savedItems = await listFn<NfItem>(TABLES.NF_ITEMS, {
      where: `(nf_import_id,eq,${nfImport.Id})`,
      sort: 'n_item',
      limit: 200,
    });

    return NextResponse.json({
      nfImport,
      items: savedItems.list,
      parsed: { nf, itemCount: items.length },
    });
  } catch (error) {
    console.error('Upload error:', error);
    const message =
      error instanceof Error ? error.message : 'Erro ao processar XML';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
