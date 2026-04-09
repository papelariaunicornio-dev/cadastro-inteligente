'use client';

import { useEffect, useState, use } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Checkbox } from '@/components/ui/checkbox';
import {
  ArrowLeft,
  Save,
  CheckCircle,
  Trash2,
  Loader2,
  ExternalLink,
} from 'lucide-react';
import type {
  ProductDraft,
  ProductImage,
  ProductVariation,
  PriceComposition,
  PriceFound,
} from '@/lib/types';
import { toast } from 'sonner';

function formatCurrency(value: number | null | undefined): string {
  if (value == null) return '—';
  return `R$ ${Number(value).toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export default function ProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const [product, setProduct] = useState<ProductDraft | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Editable fields
  const [titulo, setTitulo] = useState('');
  const [descricaoCurta, setDescricaoCurta] = useState('');
  const [descricao, setDescricao] = useState('');
  const [marca, setMarca] = useState('');
  const [categoria, setCategoria] = useState('');
  const [sku, setSku] = useState('');
  const [precoFinal, setPrecoFinal] = useState('');

  useEffect(() => {
    fetch(`/api/products/${id}`)
      .then((r) => r.json())
      .then((data: ProductDraft) => {
        setProduct(data);
        setTitulo(data.titulo || '');
        setDescricaoCurta(data.descricao_curta || '');
        setDescricao(data.descricao || '');
        setMarca(data.marca || '');
        setCategoria(data.categoria || '');
        setSku(data.sku || '');
        setPrecoFinal(data.preco_final?.toString() || '');
      })
      .catch(() => toast.error('Erro ao carregar produto'))
      .finally(() => setLoading(false));
  }, [id]);

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descricao_curta: descricaoCurta,
          descricao,
          marca,
          categoria,
          sku,
          preco_final: parseFloat(precoFinal) || 0,
        }),
      });
      toast.success('Rascunho salvo');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    setSaving(true);
    try {
      // Save first
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          titulo,
          descricao_curta: descricaoCurta,
          descricao,
          marca,
          categoria,
          sku,
          preco_final: parseFloat(precoFinal) || 0,
        }),
      });

      // Then approve
      await fetch(`/api/products/${id}/approve`, { method: 'POST' });
      toast.success('Produto aprovado!');
      router.push('/products');
    } catch {
      toast.error('Erro ao aprovar');
    } finally {
      setSaving(false);
    }
  };

  const handleDiscard = async () => {
    if (!confirm('Tem certeza que deseja descartar este produto?')) return;
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'descartado' }),
      });
      toast.success('Produto descartado');
      router.push('/products');
    } catch {
      toast.error('Erro ao descartar');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  if (!product) {
    return <p>Produto não encontrado.</p>;
  }

  const images: ProductImage[] = JSON.parse(product.imagens || '[]');
  const variacoes: ProductVariation[] = JSON.parse(product.variacoes || '[]');
  const composicao: PriceComposition | null = product.composicao_preco
    ? JSON.parse(product.composicao_preco)
    : null;
  const precosEncontrados: PriceFound[] = JSON.parse(
    product.precos_encontrados || '[]'
  );
  const fontes = JSON.parse(product.fontes || '[]');

  const isEditable = product.status === 'aguardando';

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')}>
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <h1 className="flex-1 text-xl font-bold truncate">{product.titulo}</h1>
        <Badge variant={product.status === 'aguardando' ? 'secondary' : 'default'}>
          {product.status}
        </Badge>
      </div>

      {/* Section 1: Basic Info */}
      <Card>
        <CardHeader>
          <CardTitle>Informações Básicas</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título</Label>
            <Input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              disabled={!isEditable}
              maxLength={150}
            />
            <p className="text-xs text-muted-foreground">{titulo.length}/150</p>
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Textarea
              value={descricaoCurta}
              onChange={(e) => setDescricaoCurta(e.target.value)}
              disabled={!isEditable}
              rows={2}
              maxLength={300}
            />
          </div>
          <div className="space-y-2">
            <Label>Descrição completa (HTML)</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              disabled={!isEditable}
              rows={8}
              className="font-mono text-sm"
            />
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} disabled={!isEditable} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!isEditable} />
            </div>
            <div className="space-y-2">
              <Label>SKU</Label>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} disabled={!isEditable} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>EAN</Label>
              <Input value={product.ean || ''} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>NCM</Label>
              <Input value={product.ncm || ''} disabled className="bg-gray-50" />
            </div>
            <div className="space-y-2">
              <Label>Peso (kg)</Label>
              <Input value={product.peso?.toString() || ''} disabled className="bg-gray-50" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Section 2: Images */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Imagens ({images.length} encontradas)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img, i) => (
                <div key={i} className="relative group">
                  <div className="aspect-square overflow-hidden rounded-lg border bg-gray-100">
                    <img
                      src={img.url}
                      alt={`Imagem ${i + 1}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                    />
                  </div>
                  <div className="absolute left-2 top-2">
                    <Checkbox
                      checked={img.selecionada}
                      disabled={!isEditable}
                    />
                  </div>
                  {i === 0 && (
                    <Badge className="absolute right-2 top-2 text-[10px]">
                      Principal
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 3: Variations */}
      {variacoes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>
              Variações ({variacoes.length})
              {product.tipo_variacao && (
                <Badge variant="outline" className="ml-2">
                  {product.tipo_variacao}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left font-medium">Nome</th>
                    <th className="p-2 text-left font-medium">SKU</th>
                    <th className="p-2 text-left font-medium">EAN</th>
                  </tr>
                </thead>
                <tbody>
                  {variacoes.map((v, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">{v.nome}</td>
                      <td className="p-2 font-mono text-xs">{v.sku || '—'}</td>
                      <td className="p-2 font-mono text-xs">{v.ean || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Section 4: Prices */}
      <Card>
        <CardHeader>
          <CardTitle>Preços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Three price options */}
          <div className="grid gap-4 md:grid-cols-3">
            <button
              className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left hover:border-blue-400 transition-colors"
              onClick={() => setPrecoFinal(product.preco_sugerido?.toString() || '')}
              disabled={!isEditable}
            >
              <p className="text-sm font-medium text-blue-800">Preço Sugerido (Regras)</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">
                {formatCurrency(product.preco_sugerido)}
              </p>
            </button>
            <button
              className="rounded-lg border-2 border-green-200 bg-green-50 p-4 text-left hover:border-green-400 transition-colors"
              onClick={() =>
                setPrecoFinal(product.preco_medio_ecommerce?.toString() || '')
              }
              disabled={!isEditable || !product.preco_medio_ecommerce}
            >
              <p className="text-sm font-medium text-green-800">Preço Médio E-commerce</p>
              <p className="mt-1 text-2xl font-bold text-green-900">
                {formatCurrency(product.preco_medio_ecommerce)}
              </p>
            </button>
            <button
              className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4 text-left hover:border-orange-400 transition-colors"
              onClick={() =>
                setPrecoFinal(product.preco_medio_marketplace?.toString() || '')
              }
              disabled={!isEditable || !product.preco_medio_marketplace}
            >
              <p className="text-sm font-medium text-orange-800">Preço Médio Marketplace</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">
                {formatCurrency(product.preco_medio_marketplace)}
              </p>
            </button>
          </div>

          {/* Final price */}
          <div className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label className="text-lg font-semibold">Preço final</Label>
              <div className="flex items-center gap-2">
                <span className="text-lg">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={precoFinal}
                  onChange={(e) => setPrecoFinal(e.target.value)}
                  disabled={!isEditable}
                  className="max-w-[200px] text-xl font-bold"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Price composition */}
          {composicao && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Composição do preço sugerido
              </p>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Custo c/ IPI:</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(composicao.custo_com_ipi)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Impostos ({composicao.impostos_venda_pct}%):</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(composicao.impostos_venda)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Comissão ({composicao.comissao_pct}%):</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(composicao.comissao)}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margem ({composicao.margem_pct}%):</span>
                  <span className="ml-1 font-medium">
                    {formatCurrency(composicao.margem)}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Found prices */}
          {precosEncontrados.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">
                Preços encontrados na web
              </p>
              <div className="space-y-1">
                {precosEncontrados.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">
                      {p.fonte}
                    </Badge>
                    <span className="font-mono">{formatCurrency(p.preco)}</span>
                    <a
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-blue-600 hover:underline truncate max-w-[300px]"
                    >
                      {new URL(p.url).hostname}
                      <ExternalLink className="ml-1 inline h-3 w-3" />
                    </a>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 5: Sources */}
      {fontes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fontes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {fontes.map((f: { tipo: string; url: string; titulo?: string }, i: number) => (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px]">
                    {f.tipo}
                  </Badge>
                  <a
                    href={f.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline truncate"
                  >
                    {f.titulo || f.url}
                    <ExternalLink className="ml-1 inline h-3 w-3" />
                  </a>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action buttons */}
      {isEditable && (
        <div className="flex items-center justify-between rounded-lg border bg-white p-4">
          <Button variant="destructive" size="sm" onClick={handleDiscard}>
            <Trash2 className="mr-2 h-4 w-4" />
            Descartar
          </Button>
          <div className="flex gap-3">
            <Button variant="outline" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
              Salvar rascunho
            </Button>
            <Button onClick={handleApprove} disabled={saving}>
              {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
              Aprovar e enviar
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
