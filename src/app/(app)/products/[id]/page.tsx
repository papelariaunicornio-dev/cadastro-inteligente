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
  RotateCcw,
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
import { ScoreBadge } from '@/components/products/edit/score-badge';

// Color mapping for fonte/tipo tags
function fonteBadgeClass(tipo: string): string {
  switch (tipo) {
    case 'marca': return 'border-green-400 bg-green-50 text-green-800';
    case 'ecommerce': return 'border-blue-400 bg-blue-50 text-blue-800';
    case 'marketplace': return 'border-orange-400 bg-orange-50 text-orange-800';
    default: return '';
  }
}

// Known site names by domain
const SITE_NAMES: Record<string, string> = {
  'amazon.com.br': 'Amazon',
  'mercadolivre.com.br': 'Mercado Livre',
  'shopee.com.br': 'Shopee',
  'magazineluiza.com.br': 'Magalu',
  'magalu.com.br': 'Magalu',
  'americanas.com.br': 'Americanas',
  'casasbahia.com.br': 'Casas Bahia',
  'kalunga.com.br': 'Kalunga',
  'carrefour.com.br': 'Carrefour',
  'extra.com.br': 'Extra',
  'submarino.com.br': 'Submarino',
  'aliexpress.com': 'AliExpress',
  'pentel.com.br': 'Pentel',
  'cis.com.br': 'CIS',
  'molin.com.br': 'Molin',
  'ciceros.com.br': 'Ciceros',
  'faber-castell.com.br': 'Faber-Castell',
  'papelariaunicornio.com.br': 'Papelaria Unicornio',
  'grafittiartes.com.br': 'Grafitti Artes',
  'lumen.com.mx': 'Lumen',
  'digit-eyes.com': 'Digit-Eyes',
  'walmart.com': 'Walmart',
  'walmartimages.com': 'Walmart',
};

function formatSourceLabel(url: string, titulo?: string): string {
  let siteName = '';
  try {
    const hostname = new URL(url).hostname.replace('www.', '').replace('lista.', '').replace('produto.', '');
    siteName = SITE_NAMES[hostname] || hostname.split('.')[0].charAt(0).toUpperCase() + hostname.split('.')[0].slice(1);
  } catch {
    siteName = url.substring(0, 30);
  }

  if (titulo && titulo.length > 5) {
    // Truncate title if too long
    const shortTitle = titulo.length > 60 ? titulo.substring(0, 57) + '...' : titulo;
    return `${siteName} | ${shortTitle}`;
  }

  return siteName;
}

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
  const [imageResolutions, setImageResolutions] = useState<Map<number, { w: number; h: number }>>(new Map());
  const [variacoes, setVariacoes] = useState<ProductVariation[]>([]);
  const [tipoVariacao, setTipoVariacao] = useState('');

  // Description view mode
  const [descViewMode, setDescViewMode] = useState<'rendered' | 'html'>('rendered');

  // Tiny categories
  const [tinyCategories, setTinyCategories] = useState<{ id: string; nome: string; path: string }[]>([]);

  // Send destinations
  const [sendTiny, setSendTiny] = useState(false);
  const [sendShopify, setSendShopify] = useState(false);
  const [sendNuvemshop, setSendNuvemshop] = useState(false);

  // Scores (live validation)
  const [skuScore, setSkuScore] = useState<{ score: number; status: string; flags: { severity: string; message: string }[] } | null>(null);
  const [titleScore, setTitleScore] = useState<{ score: number; status: string; flags: { severity: string; message: string }[]; suggestions: string[] } | null>(null);
  const [pricingScore, setPricingScore] = useState<{ score: number; status: string; flags: { severity: string; message: string }[]; guardrails: { precoMinimo: number; margemLiquida: number; margemLiquidaPct: number }; precoArredondado: number } | null>(null);

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
        setSendNuvemshop(destinos.includes('nuvemshop'));
      })
      .catch(() => toast.error('Erro ao carregar produto'))
      .finally(() => setLoading(false));
  }, [id]);

  // ==========================================
  // Load Tiny categories
  useEffect(() => {
    fetch('/api/integrations/tiny/categories')
      .then((r) => r.json())
      .then((data) => setTinyCategories(data.categories || []))
      .catch(() => {});
  }, []);

  // Live validation (debounced)
  // ==========================================
  useEffect(() => {
    if (!sku) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'sku', data: { sku } }),
        });
        setSkuScore(await res.json());
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [sku]);

  useEffect(() => {
    if (!titulo) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'title', data: { title: titulo, marca } }),
        });
        setTitleScore(await res.json());
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [titulo, marca]);

  useEffect(() => {
    if (!precoFinal || !product) return;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch('/api/validate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            type: 'pricing',
            data: {
              custoComIpi: product.custo_com_ipi || 0,
              freteMedio: 0,
              precoVenda: parseFloat(precoFinal) || 0,
              aliquotaImpostos: 6,
              comissaoCanal: 0,
              margemMinima: 10,
              precoMedioMercado: product.preco_medio_ecommerce || product.preco_medio_marketplace,
            },
          }),
        });
        setPricingScore(await res.json());
      } catch { /* ignore */ }
    }, 500);
    return () => clearTimeout(timer);
  }, [precoFinal, product]);

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

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      setImages((prev) => [
        ...prev,
        {
          url,
          source: 'upload',
          origem: 'scrape' as const,
          selecionada: true,
          ordem: prev.length,
        },
      ]);
    });
    e.target.value = '';
  };

  const handleImageLoaded = (index: number, w: number, h: number) => {
    setImageResolutions((prev) => {
      const next = new Map(prev);
      next.set(index, { w, h });
      return next;
    });
  };

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
    if (sendNuvemshop) destinos.push('nuvemshop');

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
    if (!sendTiny && !sendShopify && !sendNuvemshop) {
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

  const handleReprocess = async () => {
    if (!product?.job_id) return;
    if (!confirm('Reprocessar este produto? O pre-cadastro atual sera substituido.')) return;
    setSaving(true);
    try {
      // Delete current draft
      await fetch(`/api/products/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'descartado' }),
      });
      // Retry the job
      await fetch(`/api/jobs/${product.job_id}/retry`, { method: 'POST' });
      toast.success('Reprocessando produto...');
      router.push('/processing');
    } catch {
      toast.error('Erro ao reprocessar');
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push('/products')} className="self-start">
          <ArrowLeft className="mr-1 h-4 w-4" /> Voltar
        </Button>
        <h1 className="flex-1 text-lg font-bold truncate sm:text-xl">{product.titulo}</h1>
        <Badge variant={product.status === 'aguardando' ? 'secondary' : 'default'} className="self-start sm:self-auto">
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
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">{titulo.length}/150</p>
              <ScoreBadge label="Title Score" score={titleScore?.score ?? null} status={titleScore?.status ?? null} flags={titleScore?.flags} suggestions={titleScore?.suggestions} />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Descrição curta</Label>
            <Textarea value={descricaoCurta} onChange={(e) => setDescricaoCurta(e.target.value)} disabled={!isEditable} rows={2} maxLength={300} />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>Descricao completa</Label>
              <div className="flex rounded-md border text-xs overflow-hidden">
                <button
                  type="button"
                  className={cn('px-3 py-1 transition-colors', descViewMode === 'rendered' ? 'bg-primary text-white' : 'hover:bg-muted')}
                  onClick={() => setDescViewMode('rendered')}
                >
                  Visualizar
                </button>
                <button
                  type="button"
                  className={cn('px-3 py-1 transition-colors border-l', descViewMode === 'html' ? 'bg-primary text-white' : 'hover:bg-muted')}
                  onClick={() => setDescViewMode('html')}
                >
                  HTML
                </button>
              </div>
            </div>
            {descViewMode === 'html' ? (
              <Textarea value={descricao} onChange={(e) => setDescricao(e.target.value)} disabled={!isEditable} rows={8} className="font-mono text-sm" />
            ) : (
              <div
                className="min-h-[200px] rounded-md border p-4 prose prose-sm max-w-none bg-white"
                dangerouslySetInnerHTML={{ __html: descricao || '<p style="color:#999">Sem descricao</p>' }}
              />
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>Marca</Label>
              <Input value={marca} onChange={(e) => setMarca(e.target.value)} disabled={!isEditable} />
            </div>
            <div className="space-y-2">
              <Label>Categoria</Label>
              {tinyCategories.length > 0 ? (
                <>
                  <select
                    value={categoria}
                    onChange={(e) => setCategoria(e.target.value)}
                    disabled={!isEditable}
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <option value="">Selecione uma categoria</option>
                    {tinyCategories.map((cat) => (
                      <option key={cat.id} value={cat.path}>
                        {cat.path}
                      </option>
                    ))}
                  </select>
                  {categoria && !tinyCategories.some((c) => c.path === categoria) && (
                    <p className="text-[10px] text-amber-600">Categoria da IA: &quot;{categoria}&quot; (selecione uma do Tiny)</p>
                  )}
                </>
              ) : (
                <Input value={categoria} onChange={(e) => setCategoria(e.target.value)} disabled={!isEditable} />
              )}
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>SKU</Label>
                <ScoreBadge label="" score={skuScore?.score ?? null} status={skuScore?.status ?? null} compact />
              </div>
              <Input value={sku} onChange={(e) => setSku(e.target.value)} disabled={!isEditable} />
              {skuScore && skuScore.flags.length > 0 && (
                <p className="text-[10px] text-red-600">{skuScore.flags[0].message}</p>
              )}
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
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
            <div className="space-y-2">
              <Label>Estoque total</Label>
              <Input
                type="number"
                value={product.estoque?.toString() || '0'}
                disabled={!isEditable}
                className={isEditable ? '' : 'bg-gray-50'}
              />
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
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <CardTitle>Imagens ({selectedImagesCount}/{images.length} selecionadas)</CardTitle>
            {isEditable && (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" size="sm" onClick={selectAllImages}>
                  <ImagePlus className="mr-1 h-3 w-3" />
                  Selecionar todas
                </Button>
                <Button variant="outline" size="sm" onClick={deselectAllImages}>
                  <ImageOff className="mr-1 h-3 w-3" />
                  Desmarcar todas
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = (e) => handleImageUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                    input.click();
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" />
                  Minhas imagens
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {images.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-center">
              <ImageOff className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">Nenhuma imagem encontrada</p>
              {isEditable && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const input = document.createElement('input');
                    input.type = 'file';
                    input.accept = 'image/*';
                    input.multiple = true;
                    input.onchange = (e) => handleImageUpload(e as unknown as React.ChangeEvent<HTMLInputElement>);
                    input.click();
                  }}
                >
                  <Plus className="mr-1 h-3 w-3" /> Adicionar imagens
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {images.map((img, i) => {
                const res = imageResolutions.get(i);
                const isHighRes = res && (res.w > 800 || res.h > 800);
                return (
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
                          const el = e.currentTarget;
                          handleImageLoaded(i, el.naturalWidth, el.naturalHeight);
                        }}
                      />
                    </div>
                    <div className="absolute left-2 top-2">
                      <Checkbox checked={img.selecionada} disabled={!isEditable} />
                    </div>
                    {res && (
                      <div
                        className={cn(
                          'absolute left-2 bottom-2 rounded px-1.5 py-0.5 text-[9px] font-mono',
                          isHighRes
                            ? 'bg-green-600 text-white'
                            : 'bg-black/60 text-white'
                        )}
                      >
                        {res.w}×{res.h}
                      </div>
                    )}
                    {img.source === 'upload' ? (
                      <Badge variant="secondary" className="absolute right-2 bottom-2 text-[9px]">
                        Upload
                      </Badge>
                    ) : (img as ProductImage & { origem?: string }).origem ? (
                      <Badge
                        variant="outline"
                        className={cn(
                          'absolute right-2 bottom-2 text-[9px]',
                          (img as ProductImage & { origem?: string }).origem === 'searxng'
                            ? 'border-purple-400 bg-purple-50 text-purple-800'
                            : 'border-gray-400 bg-gray-50 text-gray-700'
                        )}
                      >
                        {(img as ProductImage & { origem?: string }).origem === 'searxng' ? 'Busca' : 'Scrape'}
                      </Badge>
                    ) : null}
                    {!img.selecionada && (
                      <div className="absolute inset-0 rounded-lg border-2 border-dashed border-gray-300 pointer-events-none" />
                    )}
                    {img.selecionada && i === images.findIndex((im) => im.selecionada) && (
                      <Badge className="absolute right-2 top-2 text-[10px]">
                        Principal
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

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
            <div className="rounded-md border overflow-x-auto">
              <table className="w-full min-w-[500px] text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    <th className="p-2 text-left font-medium">Nome</th>
                    <th className="p-2 text-left font-medium">SKU</th>
                    <th className="p-2 text-left font-medium">EAN</th>
                    <th className="p-2 text-center font-medium">Estoque</th>
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
                      <td className="p-2 text-center">
                        {isEditable ? (
                          <Input
                            type="number"
                            min={0}
                            value={v.estoque ?? 0}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10) || 0;
                              setVariacoes((prev) =>
                                prev.map((vv, ii) => ii === i ? { ...vv, estoque: val } : vv)
                              );
                            }}
                            className="h-8 w-16 text-center mx-auto font-mono text-xs"
                          />
                        ) : (
                          <span className="font-mono text-xs">{v.estoque ?? '—'}</span>
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
          <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
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

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2">
              <Label className="text-lg font-semibold">Preço final</Label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-lg">R$</span>
                <Input
                  type="number"
                  step="0.01"
                  value={precoFinal}
                  onChange={(e) => setPrecoFinal(e.target.value)}
                  disabled={!isEditable}
                  className="max-w-[200px] text-xl font-bold"
                />
                {isEditable && pricingScore && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPrecoFinal(pricingScore.precoArredondado.toFixed(2))}
                    title="Arredondamento psicológico (.90 ou .99)"
                  >
                    → R$ {pricingScore.precoArredondado.toFixed(2)}
                  </Button>
                )}
              </div>
              {pricingScore && (
                <div className="mt-2 space-y-1">
                  <ScoreBadge
                    label="Pricing Score"
                    score={pricingScore.score}
                    status={pricingScore.status}
                    flags={pricingScore.flags}
                  />
                  {pricingScore.guardrails && (
                    <div className="flex gap-4 text-[10px] text-muted-foreground">
                      <span>Piso: R$ {pricingScore.guardrails.precoMinimo.toFixed(2)}</span>
                      <span>Margem: {pricingScore.guardrails.margemLiquidaPct.toFixed(1)}%</span>
                      <span>(R$ {pricingScore.guardrails.margemLiquida.toFixed(2)})</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <Separator />

          {composicao && (
            <div>
              <p className="mb-2 text-sm font-medium text-muted-foreground">Composição do preço sugerido</p>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2 md:grid-cols-4">
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
                    <Badge variant="outline" className={cn('text-[10px]', fonteBadgeClass(p.fonte))}>{p.fonte}</Badge>
                    <span className="font-mono">{formatCurrency(p.preco)}</span>
                    <a href={p.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[400px]">
                      {formatSourceLabel(p.url)}
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
                  <Badge variant="outline" className={cn('text-[10px]', fonteBadgeClass(f.tipo))}>{f.tipo}</Badge>
                  <a href={f.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline truncate max-w-[500px]">
                    {formatSourceLabel(f.url, f.titulo)}
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
            <div className="flex flex-wrap gap-4 sm:gap-6">
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendTiny} onCheckedChange={(v) => setSendTiny(!!v)} />
                <span className="text-sm">Tiny ERP</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendShopify} onCheckedChange={(v) => setSendShopify(!!v)} />
                <span className="text-sm">Shopify</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <Checkbox checked={sendNuvemshop} onCheckedChange={(v) => setSendNuvemshop(!!v)} />
                <span className="text-sm">Nuvemshop</span>
              </label>
            </div>
          </div>

          <Separator />

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" size="sm" onClick={handleReprocess} disabled={saving} className="w-full sm:w-auto">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reprocessar
            </Button>
            <Button variant="destructive" size="sm" onClick={handleDiscard} className="w-full sm:w-auto">
              <Trash2 className="mr-2 h-4 w-4" />
              Descartar
            </Button>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
              <Button variant="outline" onClick={handleSave} disabled={saving} className="w-full sm:w-auto">
                {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                Salvar rascunho
              </Button>
              <Button onClick={handleApprove} disabled={saving || (!sendTiny && !sendShopify && !sendNuvemshop)} className="w-full sm:w-auto">
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
