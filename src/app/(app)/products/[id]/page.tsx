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
  ImagePlus,
  ImageOff,
  Plus,
  X,
} from 'lucide-react';
import type {
  ProductDraft,
  ProductImage,
  ProductVariation,
  PriceComposition,
  PriceFound,
} from '@/lib/types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

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
  const [tituloSeo, setTituloSeo] = useState('');
  const [descricaoSeo, setDescricaoSeo] = useState('');
  const [palavrasChave, setPalavrasChave] = useState('');
  const [images, setImages] = useState<ProductImage[]>([]);
  const [variacoes, setVariacoes] = useState<ProductVariation[]>([]);
  const [tipoVariacao, setTipoVariacao] = useState('');

  // Send destinations
  const [sendTiny, setSendTiny] = useState(false);
  const [sendShopify, setSendShopify] = useState(false);

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
        setTipoVariacao(data.tipo_variacao || '');
        const extra = data as ProductDraft & { titulo_seo?: string; descricao_seo?: string; palavras_chave?: string };
        setTituloSeo(extra.titulo_seo || '');
        setDescricaoSeo(extra.descricao_seo || '');
        setPalavrasChave(extra.palavras_chave || '');

        // Images: all deselected by default
        const imgs: ProductImage[] = JSON.parse(data.imagens || '[]');
        setImages(imgs.map((img) => ({ ...img, selecionada: false })));

        setVariacoes(JSON.parse(data.variacoes || '[]'));

        // Pre-check destinations if configured
        const destinos: string[] = data.destino_envio ? JSON.parse(data.destino_envio) : [];
        setSendTiny(destinos.includes('tiny'));
        setSendShopify(destinos.includes('shopify'));
      })
      .catch(() => toast.error('Erro ao carregar produto'))
      .finally(() => setLoading(false));
  }, [id]);

  // ==========================================
  // Image helpers
  // ==========================================
  const toggleImage = (index: number) => {
    setImages((prev) =>
      prev.map((img, i) =>
        i === index ? { ...img, selecionada: !img.selecionada } : img
      )
    );
  };

  const selectAllImages = () => {
    setImages((prev) => prev.map((img) => ({ ...img, selecionada: true })));
  };

  const deselectAllImages = () => {
    setImages((prev) => prev.map((img) => ({ ...img, selecionada: false })));
  };

  const selectedImagesCount = images.filter((i) => i.selecionada).length;

  // ==========================================
  // Variation helpers
  // ==========================================
  const updateVariation = (index: number, field: keyof ProductVariation, value: string) => {
    setVariacoes((prev) =>
      prev.map((v, i) =>
        i === index ? { ...v, [field]: value } : v
      )
    );
  };

  const addVariation = () => {
    const suffix = variacoes.length + 1;
    setVariacoes((prev) => [
      ...prev,
      {
        nome: '',
        sku: `${sku}-V${suffix}`,
        ean: '',
        imagens: [],
        atributos: {},
      },
    ]);
  };

  const removeVariation = (index: number) => {
    setVariacoes((prev) => prev.filter((_, i) => i !== index));
  };

  // Auto-generate variation SKU when parent SKU changes
  const regenerateVariationSkus = () => {
    setVariacoes((prev) =>
      prev.map((v) => {
        // Extract a short identifier from the variation name
        const shortName = v.nome
          .replace(/\s+/g, '')
          .substring(0, 4)
          .replace(/[^a-zA-Z0-9]/g, '');
        return {
          ...v,
          sku: `${sku}-${shortName || 'V'}`,
        };
      })
    );
  };

  // ==========================================
  // Save / Approve / Discard
  // ==========================================
  const buildSavePayload = () => {
    const destinos: string[] = [];
    if (sendTiny) destinos.push('tiny');
    if (sendShopify) destinos.push('shopify');

    return {
      titulo,
      descricao_curta: descricaoCurta,
      descricao,
      marca,
      categoria,
      sku,
      preco_final: parseFloat(precoFinal) || 0,
      titulo_seo: tituloSeo,
      descricao_seo: descricaoSeo,
      palavras_chave: palavrasChave,
      imagens: JSON.stringify(images),
      variacoes: JSON.stringify(variacoes),
      tipo_variacao: tipoVariacao || null,
      tem_variacoes: variacoes.length > 0,
      destino_envio: JSON.stringify(destinos),
    };
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSavePayload()),
      });
      toast.success('Rascunho salvo');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async () => {
    if (!sendTiny && !sendShopify) {
      toast.error('Selecione ao menos uma plataforma de destino');
      return;
    }
    setSaving(true);
    try {
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildSavePayload()),
      });
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

  // ==========================================
  // Render
  // ==========================================
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
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} disabled={!isEditable} maxLength={150} />
            <p className="text-xs text-muted-foreground">{titulo.length}/150</p>
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Textarea value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} disabled={!isEditable} rows={2} maxLength={300} />
          </div>
          <div className="space-y-2">
            <Label>Descrição completa (HTML)</Label>
            <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={!isEditable} rows={8} className="font-mono text-sm" />
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

      {/* Section: SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Título SEO</Label>
            <Input value={tituloSeo} onChange={(e) => setTituloSeo(e.target.value)} disabled={!isEditable} maxLength={70} placeholder="Título otimizado para mecanismos de busca" />
            <p className="text-xs text-muted-foreground">{tituloSeo.length}/70</p>
          </div>
          <div className="space-y-2">
            <Label>Descrição SEO (meta description)</Label>
            <Textarea value={descricaoSeo} onChange={(e) => setDescricaoSeo(e.target.value)} disabled={!isEditable} rows={2} maxLength={160} placeholder="Descrição que aparece nos resultados de busca" />
            <p className="text-xs text-muted-foreground">{descricaoSeo.length}/160</p>
          </div>
          <div className="space-y-2">
            <Label>Palavras-chave</Label>
            <Input value={palavrasChave} onChange={(e) => setPalavrasChave(e.target.value)} disabled={!isEditable} placeholder="caneta, esferográfica, azul, escritório (separadas por vírgula)" />
          </div>
          {/* SEO Preview */}
          {(tituloSeo || titulo) && (
            <div className="rounded-lg border bg-white p-4">
              <p className="text-xs text-muted-foreground mb-1">Pré-visualização no Google</p>
              <p className="text-blue-700 text-lg hover:underline cursor-default truncate">
                {tituloSeo || titulo}
              </p>
              <p className="text-green-700 text-sm">www.suaempresa.com.br › produto</p>
              <p className="text-sm text-gray-600 line-clamp-2">
                {descricaoSeo || descricaoCurta || 'Descrição do produto...'}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Images */}
      {images.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Imagens ({selectedImagesCount}/{images.length} selecionadas)</CardTitle>
              {isEditable && (
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={selectAllImages}>
                    <ImagePlus className="mr-1 h-3 w-3" />
                    Selecionar todas
                  </Button>
                  <Button variant="outline" size="sm" onClick={deselectAllImages}>
                    <ImageOff className="mr-1 h-3 w-3" />
                    Desmarcar todas
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img, i) => (
                <div
                  key={i}
                  className={cn(
                    'relative group cursor-pointer rounded-lg border-2 transition-all',
                    img.selecionada
                      ? 'border-primary ring-2 ring-primary/20'
                      : 'border-transparent hover:border-gray-300'
                  )}
                  onClick={() => isEditable && toggleImage(i)}
                >
                  <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
                    <img
                      src={img.url}
                      alt={`Imagem ${i + 1}`}
                      className="h-full w-full object-contain"
                      loading="lazy"
                      onLoad={(e) => {
                        const imgEl = e.currentTarget;
                        const badge = imgEl.parentElement?.parentElement?.querySelector('[data-res]');
                        if (badge) badge.textContent = `${imgEl.naturalWidth}×${imgEl.naturalHeight}`;
                      }}
                    />
                  </div>
                  <div className="absolute left-2 top-2">
                    <Checkbox checked={img.selecionada} disabled={!isEditable} />
                  </div>
                  <div
                    data-res
                    className="absolute left-2 bottom-2 rounded bg-black/60 px-1.5 py-0.5 text-[9px] font-mono text-white"
                  >
                    ...
                  </div>
                  {!img.selecionada && (
                    <div className="absolute inset-0 rounded-lg border-2 border-dashed border-gray-300 pointer-events-none" />
                  )}
                  {img.selecionada && i === images.findIndex((im) => im.selecionada) && (
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              Variações ({variacoes.length})
              {isEditable && variacoes.length > 0 && (
                <Input
                  value={tipoVariacao}
                  onChange={(e) => setTipoVariacao(e.target.value)}
                  placeholder="Tipo (ex: Cor)"
                  className="ml-2 h-7 w-32 text-xs"
                />
              )}
            </CardTitle>
            {isEditable && (
              <div className="flex gap-2">
                {variacoes.length > 0 && (
                  <Button variant="outline" size="sm" onClick={regenerateVariationSkus}>
                    Gerar SKUs
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={addVariation}>
                  <Plus className="mr-1 h-3 w-3" />
                  Adicionar
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {variacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhuma variação.{' '}
              {isEditable && (
                <button className="text-primary hover:underline" onClick={addVariation}>
                  Adicionar variação
                </button>
              )}
            </p>
          ) : (
            <div className="rounded-md border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left font-medium">Nome</th>
                    <th className="p-2 text-left font-medium">SKU</th>
                    <th className="p-2 text-left font-medium">EAN</th>
                    {isEditable && <th className="w-10 p-2"></th>}
                  </tr>
                </thead>
                <tbody>
                  {variacoes.map((v, i) => (
                    <tr key={i} className="border-b last:border-0">
                      <td className="p-2">
                        {isEditable ? (
                          <Input
                            value={v.nome}
                            onChange={(e) => updateVariation(i, 'nome', e.target.value)}
                            className="h-8 text-sm"
                            placeholder="Nome da variação"
                          />
                        ) : (
                          v.nome
                        )}
                      </td>
                      <td className="p-2">
                        {isEditable ? (
                          <Input
                            value={v.sku}
                            onChange={(e) => updateVariation(i, 'sku', e.target.value)}
                            className="h-8 font-mono text-xs"
                            placeholder="SKU"
                          />
                        ) : (
                          <span className="font-mono text-xs">{v.sku || '—'}</span>
                        )}
                      </td>
                      <td className="p-2">
                        {isEditable ? (
                          <Input
                            value={v.ean}
                            onChange={(e) => updateVariation(i, 'ean', e.target.value)}
                            className="h-8 font-mono text-xs"
                            placeholder="EAN"
                          />
                        ) : (
                          <span className="font-mono text-xs">{v.ean || '—'}</span>
                        )}
                      </td>
                      {isEditable && (
                        <td className="p-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0 text-red-500 hover:text-red-700"
                            onClick={() => removeVariation(i)}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 4: Prices */}
      <Card>
        <CardHeader>
          <CardTitle>Preços</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 md:grid-cols-3">
            <button
              className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4 text-left hover:border-blue-400 transition-colors"
              onClick={() => setPrecoFinal(product.preco_sugerido?.toString() || '')}
              disabled={!isEditable}
            >
              <p className="text-sm font-medium text-blue-800">Preço Sugerido (Regras)</p>
              <p className="mt-1 text-2xl font-bold text-blue-900">{formatCurrency(product.preco_sugerido)}</p>
            </button>
            <button
              className="rounded-lg border-2 border-green-200 bg-green-50 p-4 text-left hover:border-green-400 transition-colors"
              onClick={() => setPrecoFinal(product.preco_medio_ecommerce?.toString() || '')}
              disabled={!isEditable || !product.preco_medio_ecommerce}
            >
              <p className="text-sm font-medium text-green-800">Preço Médio E-commerce</p>
              <p className="mt-1 text-2xl font-bold text-green-900">{formatCurrency(product.preco_medio_ecommerce)}</p>
            </button>
            <button
              className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4 text-left hover:border-orange-400 transition-colors"
              onClick={() => setPrecoFinal(product.preco_medio_marketplace?.toString() || '')}
              disabled={!isEditable || !product.preco_medio_marketplace}
            >
              <p className="text-sm font-medium text-orange-800">Preço Médio Marketplace</p>
              <p className="mt-1 text-2xl font-bold text-orange-900">{formatCurrency(product.preco_medio_marketplace)}</p>
            </button>
          </div>

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

          {composicao && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Composição do preço sugerido</p>
              <div className="grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Custo c/ IPI:</span>
                  <span className="ml-1 font-medium">{formatCurrency(composicao.custo_com_ipi)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Impostos ({composicao.impostos_venda_pct}%):</span>
                  <span className="ml-1 font-medium">{formatCurrency(composicao.impostos_venda)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Comissão ({composicao.comissao_pct}%):</span>
                  <span className="ml-1 font-medium">{formatCurrency(composicao.comissao)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Margem ({composicao.margem_pct}%):</span>
                  <span className="ml-1 font-medium">{formatCurrency(composicao.margem)}</span>
                </div>
              </div>
            </div>
          )}

          {precosEncontrados.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Preços encontrados na web</p>
              <div className="space-y-1">
                {precosEncontrados.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <Badge variant="outline" className="text-[10px]">{p.fonte}</Badge>
                    <span className="font-mono">{formatCurrency(p.preco)}</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[300px]">
                      {(() => { try { return new URL(p.url).hostname; } catch { return p.url; } })()}
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
                  <Badge variant="outline" className="text-[10px]">{f.tipo}</Badge>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate">
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
        <div className="rounded-lg border bg-white p-4 space-y-4">
          {/* Send destinations */}
          <div>
            <p className="text-sm font-medium mb-2">Enviar para:</p>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendTiny} onCheckedChange={(v) => setSendTiny(!!v)} />
                <span className="text-sm">Tiny ERP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendShopify} onCheckedChange={(v) => setSendShopify(!!v)} />
                <span className="text-sm">Shopify</span>
              </label>
            </div>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <Button variant="destructive" size="sm" onClick={handleDiscard}>
              <Trash2 className="mr-2 h-4 w-4" />
              Descartar
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={handleSave} disabled={saving}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button onClick={handleApprove} disabled={saving || (!sendTiny && !sendShopify)}>
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <CheckCircle className="mr-2 h-4 w-4" />}
                Aprovar e enviar
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
