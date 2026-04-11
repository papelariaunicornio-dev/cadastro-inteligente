'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Upload,
  Clock,
  Package,
  CheckCircle,
  FileText,
  Loader2,
  Cpu,
  Flame,
} from 'lucide-react';
import type { NfImport } from '@/lib/types';

interface Counts {
  processando: number;
  aguardando: number;
  aprovados: number;
}

interface CostsData {
  totalTokens: number;
  totalCredits: number;
  productCount: number;
  avgTokensPerProduct: number;
  avgCreditsPerProduct: number;
}

interface DashboardViewProps {
  initialCounts: Counts;
  initialNfs: NfImport[];
}

export function DashboardView({ initialCounts, initialNfs }: DashboardViewProps) {
  const [counts, setCounts] = useState(initialCounts);
  const [recentNfs, setRecentNfs] = useState(initialNfs);
  const [costs, setCosts] = useState<CostsData | null>(null);

  // Poll for updates (counts change as jobs process)
  const refresh = useCallback(async () => {
    try {
      const [countsRes, nfsRes, costsRes] = await Promise.all([
        fetch('/api/products/counts'),
        fetch('/api/nf/recent'),
        fetch('/api/products/costs'),
      ]);
      setCounts(await countsRes.json());
      setCosts(await costsRes.json());
      const nfsData = await nfsRes.json();
      setRecentNfs(nfsData.list || []);
    } catch { /* ignore poll errors */ }
  }, []);

  useEffect(() => {
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, [refresh]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            Visão geral do cadastro de produtos
          </p>
        </div>
        <Link href="/import">
          <Button className="w-full bg-[#33A9AC] hover:bg-[#2a8e90] sm:w-auto">
            <Upload className="mr-2 h-4 w-4" />
            Importar XML
          </Button>
        </Link>
      </div>

      <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
        <Card className="border-l-4 border-l-[#FFA646]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Em processamento</CardTitle>
            <Clock className="h-5 w-5 text-[#FFA646]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.processando}</p>
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#33A9AC]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aguardando aprovação</CardTitle>
            <Package className="h-5 w-5 text-[#33A9AC]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.aguardando}</p>
            {counts.aguardando > 0 && (
              <Link href="/products" className="text-xs text-[#33A9AC] hover:underline">Ver produtos →</Link>
            )}
          </CardContent>
        </Card>
        <Card className="border-l-4 border-l-[#982062]">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Aprovados / Enviados</CardTitle>
            <CheckCircle className="h-5 w-5 text-[#982062]" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.aprovados}</p>
          </CardContent>
        </Card>
      </div>

      {/* API Costs */}
      {costs && costs.productCount > 0 && (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">OpenAI Tokens</CardTitle>
              <Cpu className="h-5 w-5 text-[#343779]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{costs.totalTokens.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground">
                Média: {costs.avgTokensPerProduct.toLocaleString('pt-BR')} tokens/produto
                ({costs.productCount} produtos)
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Firecrawl Créditos</CardTitle>
              <Flame className="h-5 w-5 text-[#F86041]" />
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-bold">{costs.totalCredits.toLocaleString('pt-BR')}</p>
              <p className="text-xs text-muted-foreground">
                Média: {costs.avgCreditsPerProduct} créditos/produto
                ({costs.productCount} produtos)
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Importações recentes</CardTitle>
        </CardHeader>
        <CardContent>
          {recentNfs.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <FileText className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma NF importada ainda</p>
              <Link href="/import">
                <Button variant="outline" size="sm">Importar primeiro XML</Button>
              </Link>
            </div>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>NF</TableHead>
                  <TableHead>Fornecedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead>Data</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {recentNfs.map((nf) => (
                  <TableRow key={nf.Id}>
                    <TableCell>
                      <Badge variant="outline" className="font-mono">{nf.numero_nf}</Badge>
                    </TableCell>
                    <TableCell className="font-medium">
                      {nf.fornecedor_fantasia || nf.fornecedor_nome}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">
                      R$ {Number(nf.valor_total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {nf.data_emissao ? new Date(nf.data_emissao).toLocaleDateString('pt-BR') : '—'}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
