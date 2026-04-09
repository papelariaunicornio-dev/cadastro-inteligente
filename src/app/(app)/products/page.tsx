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
import { Loader2, Eye, Package, Clock, CheckCircle } from 'lucide-react';
import type { ProductDraft } from '@/lib/types';

interface Counts {
  processando: number;
  aguardando: number;
  aprovados: number;
}

const STATUS_BADGE: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  aguardando: { label: 'Aguardando', variant: 'secondary' },
  aprovado: { label: 'Aprovado', variant: 'default' },
  enviado: { label: 'Enviado', variant: 'default' },
  erro_envio: { label: 'Erro no envio', variant: 'destructive' },
  descartado: { label: 'Descartado', variant: 'outline' },
};

export default function ProductsPage() {
  const [counts, setCounts] = useState<Counts>({ processando: 0, aguardando: 0, aprovados: 0 });
  const [products, setProducts] = useState<ProductDraft[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [countsRes, productsRes] = await Promise.all([
        fetch('/api/products/counts'),
        fetch('/api/products'),
      ]);
      const countsData = await countsRes.json();
      const productsData = await productsRes.json();
      setCounts(countsData);
      setProducts(productsData.list || []);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    // Poll every 5s when there are processing jobs
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const firstImage = (product: ProductDraft): string | null => {
    try {
      const imgs = JSON.parse(product.imagens || '[]');
      const selected = imgs.find((i: { selecionada: boolean }) => i.selecionada);
      return selected?.url || imgs[0]?.url || null;
    } catch {
      return null;
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Produtos</h1>

      {/* Status cards */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Em processamento
            </CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.processando}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aguardando aprovação
            </CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.aguardando}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Aprovados
            </CardTitle>
            <CheckCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{counts.aprovados}</p>
          </CardContent>
        </Card>
      </div>

      {/* Products table */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : products.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhum produto processado ainda. Importe um XML para começar.
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-md border bg-white">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-16">Img</TableHead>
                <TableHead>Título</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead className="text-center">Variações</TableHead>
                <TableHead className="text-right">Preço Sugerido</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-20">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product) => {
                const img = firstImage(product);
                const variacoes = product.variacoes
                  ? JSON.parse(product.variacoes).length
                  : 0;
                const badge = STATUS_BADGE[product.status] || STATUS_BADGE.aguardando;

                return (
                  <TableRow key={product.Id}>
                    <TableCell>
                      {img ? (
                        <img
                          src={img}
                          alt=""
                          className="h-10 w-10 rounded object-cover"
                        />
                      ) : (
                        <div className="flex h-10 w-10 items-center justify-center rounded bg-gray-100">
                          <Package className="h-5 w-5 text-gray-400" />
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="max-w-[300px]">
                      <p className="truncate font-medium">{product.titulo}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {product.marca}
                    </TableCell>
                    <TableCell className="text-center">
                      {variacoes > 0 ? (
                        <Badge variant="outline">{variacoes}</Badge>
                      ) : (
                        '—'
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {product.preco_sugerido
                        ? `R$ ${Number(product.preco_sugerido).toFixed(2)}`
                        : '—'}
                    </TableCell>
                    <TableCell>
                      <Badge variant={badge.variant}>{badge.label}</Badge>
                    </TableCell>
                    <TableCell>
                      <Link href={`/products/${product.Id}`}>
                        <Button size="sm" variant="ghost">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
