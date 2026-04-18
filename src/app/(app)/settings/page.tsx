'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Save, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserSettings } from '@/lib/types';
import { IntegrationsPanel } from '@/components/settings/integrations-panel';
import { ConcorrentesSection } from '@/components/settings/concorrentes-section';

export default function SettingsPage() {
  const [settings, setSettings] = useState<Partial<UserSettings>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch('/api/settings')
      .then((r) => r.json())
      .then(setSettings)
      .catch(() => toast.error('Erro ao carregar configurações'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Only send editable fields, not read-only ones like Id, CreatedAt
      // Only send business config fields — tokens are env vars, never in DB
      const {
        nome_loja, segmento, publico_alvo, tom_de_voz, diferenciais,
        regime_tributario, aliquota_impostos, margem_desejada,
        comissao_ecommerce, comissao_ml, comissao_shopee,
        frete_medio_unidade, taxas_fixas,
        template_titulo, tamanho_max_titulo, instrucoes_descricao,
        prefixo_sku, formato_sku, sites_concorrentes,
      } = settings;

      await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nome_loja, segmento, publico_alvo, tom_de_voz, diferenciais,
          regime_tributario, aliquota_impostos, margem_desejada,
          comissao_ecommerce, comissao_ml, comissao_shopee,
          frete_medio_unidade, taxas_fixas,
          template_titulo, tamanho_max_titulo, instrucoes_descricao,
          prefixo_sku, formato_sku, sites_concorrentes,
        }),
      });
      toast.success('Configurações salvas');
    } catch {
      toast.error('Erro ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const update = (field: string, value: unknown) =>
    setSettings((prev) => ({ ...prev, [field]: value }));

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">Configurações</h1>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar
        </Button>
      </div>

      {/* Empresa */}
      <Card>
        <CardHeader>
          <CardTitle>Empresa</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Nome da loja</Label>
              <Input value={settings.nome_loja || ''} onChange={(e) => update('nome_loja', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Segmento</Label>
              <Input value={settings.segmento || ''} onChange={(e) => update('segmento', e.target.value)} placeholder="Papelaria e escritório" />
            </div>
          </div>
          <div className="space-y-2">
            <Label>Público-alvo</Label>
            <Textarea value={settings.publico_alvo || ''} onChange={(e) => update('publico_alvo', e.target.value)} rows={2} placeholder="Estudantes, profissionais, empresas" />
          </div>
          <div className="space-y-2">
            <Label>Tom de voz</Label>
            <Textarea value={settings.tom_de_voz || ''} onChange={(e) => update('tom_de_voz', e.target.value)} rows={2} placeholder="Jovem, descontraído, focado em design" />
          </div>
          <div className="space-y-2">
            <Label>Diferenciais</Label>
            <Textarea value={settings.diferenciais || ''} onChange={(e) => update('diferenciais', e.target.value)} rows={2} placeholder="Entrega rápida, curadoria de produtos" />
          </div>
        </CardContent>
      </Card>

      {/* Preço */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de Preço</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
            <div className="space-y-2">
              <Label>Regime tributário</Label>
              <Input value={settings.regime_tributario || 'simples_nacional'} onChange={(e) => update('regime_tributario', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Alíquota impostos (%)</Label>
              <Input type="number" step="0.1" value={settings.aliquota_impostos ?? 6} onChange={(e) => update('aliquota_impostos', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Margem desejada (%)</Label>
              <Input type="number" step="0.1" value={settings.margem_desejada ?? 40} onChange={(e) => update('margem_desejada', parseFloat(e.target.value))} />
            </div>
          </div>
          <Separator />
          <p className="text-sm font-medium text-muted-foreground">Comissões por canal</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label>E-commerce próprio (%)</Label>
              <Input type="number" step="0.1" value={settings.comissao_ecommerce ?? 0} onChange={(e) => update('comissao_ecommerce', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Mercado Livre (%)</Label>
              <Input type="number" step="0.1" value={settings.comissao_ml ?? 16} onChange={(e) => update('comissao_ml', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Shopee (%)</Label>
              <Input type="number" step="0.1" value={settings.comissao_shopee ?? 20} onChange={(e) => update('comissao_shopee', parseFloat(e.target.value))} />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Frete médio/unidade (R$)</Label>
              <Input type="number" step="0.01" value={settings.frete_medio_unidade ?? 0} onChange={(e) => update('frete_medio_unidade', parseFloat(e.target.value))} />
            </div>
            <div className="space-y-2">
              <Label>Taxas fixas/unidade (R$)</Label>
              <Input type="number" step="0.01" value={settings.taxas_fixas ?? 0} onChange={(e) => update('taxas_fixas', parseFloat(e.target.value))} />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Conteúdo */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de Conteúdo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Template de título</Label>
            <Input value={settings.template_titulo || ''} onChange={(e) => update('template_titulo', e.target.value)} placeholder="{Produto} {Marca} {Atributo} - {Variação}" />
          </div>
          <div className="space-y-2">
            <Label>Tamanho máximo do título</Label>
            <Input type="number" value={settings.tamanho_max_titulo ?? 150} onChange={(e) => update('tamanho_max_titulo', parseInt(e.target.value))} />
          </div>
          <div className="space-y-2">
            <Label>Instruções para a IA (descrição)</Label>
            <Textarea value={settings.instrucoes_descricao || ''} onChange={(e) => update('instrucoes_descricao', e.target.value)} rows={3} placeholder="Descreva o tom, estilo e informações que a IA deve incluir nas descrições" />
          </div>
        </CardContent>
      </Card>

      {/* SKU */}
      <Card>
        <CardHeader>
          <CardTitle>Regras de SKU</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Prefixo do SKU</Label>
              <Input value={settings.prefixo_sku || ''} onChange={(e) => update('prefixo_sku', e.target.value)} placeholder="PU" />
            </div>
            <div className="space-y-2">
              <Label>Formato</Label>
              <Input value={settings.formato_sku || ''} onChange={(e) => update('formato_sku', e.target.value)} placeholder="{PREFIXO}-{MARCA3}-{SEQ}" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sites Concorrentes */}
      <ConcorrentesSection settings={settings} update={update} />

      {/* Integrações */}
      <Card>
        <CardHeader>
          <CardTitle>Integrações</CardTitle>
          <p className="text-xs text-muted-foreground">
            Configure as integrações com seu ERP e plataformas de e-commerce. Tokens são armazenados criptografados.
          </p>
        </CardHeader>
        <CardContent>
          <IntegrationsPanel />
        </CardContent>
      </Card>

      {/* Save button (bottom) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
          Salvar configurações
        </Button>
      </div>
    </div>
  );
}
