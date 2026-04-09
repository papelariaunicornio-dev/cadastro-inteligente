'use client';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useImportStore } from '@/store/import-store';

export function NfHeader() {
  const nfImport = useImportStore((s) => s.nfImport);

  if (!nfImport) return null;

  const dataFormatada = nfImport.data_emissao
    ? new Date(nfImport.data_emissao).toLocaleDateString('pt-BR')
    : '';

  return (
    <Card>
      <CardContent className="flex flex-wrap items-center gap-6 p-4">
        <div>
          <span className="text-xs text-muted-foreground">NF</span>
          <p className="font-semibold">{nfImport.numero_nf}</p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">Emissão</span>
          <p className="font-semibold">{dataFormatada}</p>
        </div>
        <div className="flex-1">
          <span className="text-xs text-muted-foreground">Fornecedor</span>
          <p className="font-semibold">
            {nfImport.fornecedor_fantasia || nfImport.fornecedor_nome}
          </p>
        </div>
        <div>
          <span className="text-xs text-muted-foreground">CNPJ</span>
          <p className="font-mono text-sm">{nfImport.fornecedor_cnpj}</p>
        </div>
        <div className="text-right">
          <span className="text-xs text-muted-foreground">Total NF</span>
          <p className="font-semibold">
            <Badge variant="secondary" className="text-base">
              R${' '}
              {Number(nfImport.valor_total).toLocaleString('pt-BR', {
                minimumFractionDigits: 2,
              })}
            </Badge>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
