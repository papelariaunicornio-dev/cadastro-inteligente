'use client';

import { useCallback, useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  Settings2,
  Trash2,
  Wifi,
  WifiOff,
  Lock,
  AlertCircle,
} from 'lucide-react';
import { toast } from 'sonner';

// ==========================================
// Types
// ==========================================

interface IntegrationStatus {
  configured: boolean;
  source: 'db' | 'env' | null;
  label: string;
  configurable: boolean;
  storeUrl?: string | null;
  storeId?: string | null;
}

interface StatusData {
  tiny: IntegrationStatus;
  shopify: IntegrationStatus;
  nuvemshop: IntegrationStatus;
  firecrawl: IntegrationStatus;
  openai: IntegrationStatus;
  encryptionAvailable: boolean;
}

type IntegrationKey = 'tiny' | 'shopify' | 'nuvemshop';

// ==========================================
// Individual integration card
// ==========================================

interface IntegrationCardProps {
  id: IntegrationKey | 'firecrawl' | 'openai';
  status: IntegrationStatus;
  onConfigure?: () => void;
  onTest: () => void;
  testing: boolean;
  testResult: { ok: boolean; message: string } | null;
}

function IntegrationCard({
  id,
  status,
  onConfigure,
  onTest,
  testing,
  testResult,
}: IntegrationCardProps) {
  const logoMap: Record<string, string> = {
    tiny: '🟦',
    shopify: '🟩',
    nuvemshop: '🟪',
    firecrawl: '🔥',
    openai: '✨',
  };

  return (
    <div className="rounded-xl border bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{logoMap[id]}</span>
          <div>
            <p className="font-semibold text-gray-900">{status.label}</p>
            <div className="mt-0.5 flex items-center gap-2">
              {status.configured ? (
                <Badge variant="secondary" className="gap-1 bg-green-100 px-1.5 py-0 text-[10px] text-green-800">
                  <CheckCircle2 className="h-2.5 w-2.5" />
                  Configurado
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 px-1.5 py-0 text-[10px] text-muted-foreground">
                  <XCircle className="h-2.5 w-2.5" />
                  Não configurado
                </Badge>
              )}
              {status.source === 'db' && (
                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Lock className="h-2.5 w-2.5" />
                  Banco
                </span>
              )}
              {status.source === 'env' && (
                <span className="text-[10px] text-muted-foreground">Env var</span>
              )}
            </div>
            {(status.storeUrl || status.storeId) && (
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {status.storeUrl || `ID: ${status.storeId}`}
              </p>
            )}
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          {status.configured && (
            <Button
              variant="outline"
              size="sm"
              onClick={onTest}
              disabled={testing}
              className="h-7 px-2 text-xs"
            >
              {testing ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Wifi className="h-3 w-3" />
              )}
              <span className="ml-1 hidden sm:inline">Testar</span>
            </Button>
          )}
          {status.configurable && (
            <Button
              variant={status.configured ? 'ghost' : 'default'}
              size="sm"
              onClick={onConfigure}
              className="h-7 px-2 text-xs"
            >
              <Settings2 className="h-3 w-3" />
              <span className="ml-1 hidden sm:inline">
                {status.configured ? 'Editar' : 'Configurar'}
              </span>
            </Button>
          )}
        </div>
      </div>

      {/* Test result */}
      {testResult && (
        <div
          className={`mt-3 flex items-center gap-2 rounded-lg px-3 py-2 text-sm ${
            testResult.ok
              ? 'bg-green-50 text-green-800'
              : 'bg-red-50 text-red-800'
          }`}
        >
          {testResult.ok ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : (
            <WifiOff className="h-4 w-4 shrink-0" />
          )}
          <span>{testResult.ok ? `Conectado: ${testResult.message}` : testResult.message}</span>
        </div>
      )}
    </div>
  );
}

// ==========================================
// Dialog forms
// ==========================================

interface TinyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (token: string) => Promise<void>;
  onDelete: () => Promise<void>;
  hasExisting: boolean;
  saving: boolean;
}

function TinyDialog({ open, onClose, onSave, onDelete, hasExisting, saving }: TinyDialogProps) {
  const [token, setToken] = useState('');

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🟦 Tiny ERP v2</DialogTitle>
          <DialogDescription>
            Insira seu token de API do Tiny ERP. O token é armazenado criptografado no banco de dados.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="tiny-token">Token de API</Label>
            <Input
              id="tiny-token"
              type="password"
              placeholder={hasExisting ? '••••••••••• (manter atual)' : 'Cole seu token aqui'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Encontre em: Tiny ERP → Integrações → API → Token de acesso
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {hasExisting && (
            <Button
              type="button"
              variant="outline"
              className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={() => token && onSave(token)} disabled={saving || !token}>
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface ShopifyDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (storeUrl: string, token: string) => Promise<void>;
  onDelete: () => Promise<void>;
  hasExisting: boolean;
  existingUrl: string | null | undefined;
  saving: boolean;
}

function ShopifyDialog({
  open, onClose, onSave, onDelete, hasExisting, existingUrl, saving,
}: ShopifyDialogProps) {
  const [storeUrl, setStoreUrl] = useState(existingUrl || '');
  const [token, setToken] = useState('');

  useEffect(() => {
    if (open) setStoreUrl(existingUrl || '');
  }, [open, existingUrl]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🟩 Shopify</DialogTitle>
          <DialogDescription>
            Configure a integração com sua loja Shopify. As credenciais são armazenadas criptografadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="shopify-url">URL da loja</Label>
            <Input
              id="shopify-url"
              placeholder="minha-loja.myshopify.com"
              value={storeUrl}
              onChange={(e) => setStoreUrl(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Somente o domínio, sem https://
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="shopify-token">Access Token</Label>
            <Input
              id="shopify-token"
              type="password"
              placeholder={hasExisting ? '••••••••••• (manter atual)' : 'shpat_xxxxxxxxxxxxxx'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Crie em: Admin Shopify → Apps → Develop apps → Tokens
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {hasExisting && (
            <Button
              type="button"
              variant="outline"
              className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => storeUrl && token && onSave(storeUrl, token)}
              disabled={saving || !storeUrl || !token}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface NuvemshopDialogProps {
  open: boolean;
  onClose: () => void;
  onSave: (storeId: string, token: string) => Promise<void>;
  onDelete: () => Promise<void>;
  hasExisting: boolean;
  existingStoreId: string | null | undefined;
  saving: boolean;
}

function NuvemshopDialog({
  open, onClose, onSave, onDelete, hasExisting, existingStoreId, saving,
}: NuvemshopDialogProps) {
  const [storeId, setStoreId] = useState(existingStoreId || '');
  const [token, setToken] = useState('');

  useEffect(() => {
    if (open) setStoreId(existingStoreId || '');
  }, [open, existingStoreId]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>🟪 Nuvemshop</DialogTitle>
          <DialogDescription>
            Configure a integração com sua loja Nuvemshop. As credenciais são armazenadas criptografadas.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="ns-store-id">ID da loja</Label>
            <Input
              id="ns-store-id"
              placeholder="123456"
              value={storeId}
              onChange={(e) => setStoreId(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Encontrado na URL do painel: /admin/{'{'}storeId{'}'}
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ns-token">Access Token</Label>
            <Input
              id="ns-token"
              type="password"
              placeholder={hasExisting ? '••••••••••• (manter atual)' : 'Cole seu token aqui'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              autoComplete="off"
            />
            <p className="text-xs text-muted-foreground">
              Gere em: Minha conta Nuvemshop → Apps → Criar aplicativo
            </p>
          </div>
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          {hasExisting && (
            <Button
              type="button"
              variant="outline"
              className="gap-1 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={onDelete}
              disabled={saving}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Remover
            </Button>
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button
              onClick={() => storeId && token && onSave(storeId, token)}
              disabled={saving || !storeId || !token}
            >
              {saving && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              Salvar
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ==========================================
// Main panel
// ==========================================

export function IntegrationsPanel() {
  const [data, setData] = useState<StatusData | null>(null);
  const [loading, setLoading] = useState(true);

  // Dialog state
  const [openDialog, setOpenDialog] = useState<IntegrationKey | null>(null);
  const [saving, setSaving] = useState(false);

  // Test state
  const [testing, setTesting] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, { ok: boolean; message: string }>>({});

  const fetchStatus = useCallback(() => {
    setLoading(true);
    fetch('/api/integrations/status')
      .then((r) => r.json())
      .then(setData)
      .catch(() => toast.error('Erro ao carregar integrações'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleTest = async (integration: string) => {
    setTesting(integration);
    try {
      const res = await fetch('/api/integrations/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ integration }),
      });
      const result = (await res.json()) as { ok: boolean; message: string };
      setTestResults((prev) => ({ ...prev, [integration]: result }));
      const integrationObj = data ? data[integration as keyof StatusData] : null;
      const label = integrationObj && typeof integrationObj === 'object' && 'label' in integrationObj
        ? (integrationObj as IntegrationStatus).label
        : integration;
      if (result.ok) {
        toast.success(`${label}: ${result.message}`);
      } else {
        toast.error(`${label}: ${result.message}`);
      }
    } catch {
      toast.error('Erro ao testar conexão');
    } finally {
      setTesting(null);
    }
  };

  async function configure(body: Record<string, unknown>) {
    setSaving(true);
    try {
      const res = await fetch('/api/integrations/configure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const result = (await res.json()) as { ok?: boolean; error?: string; detail?: string };

      if (!res.ok || result.error) {
        toast.error(result.detail || result.error || 'Erro ao salvar');
        return false;
      }

      toast.success('Credenciais salvas com segurança');
      setOpenDialog(null);
      fetchStatus();
      // Clear old test result for this integration
      const key = body.integration as string;
      setTestResults((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      return true;
    } catch {
      toast.error('Erro ao salvar credenciais');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(integration: IntegrationKey) {
    await configure({ integration, action: 'delete' });
  }

  if (loading) {
    return (
      <div className="flex justify-center py-6">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const configurableIntegrations: IntegrationKey[] = ['tiny', 'shopify', 'nuvemshop'];
  const readonlyIntegrations = ['firecrawl', 'openai'] as const;

  return (
    <div className="space-y-3">
      {/* Encryption warning */}
      {!data.encryptionAvailable && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-medium">Criptografia não configurada</p>
            <p className="text-xs text-amber-700">
              Para salvar tokens no banco, defina <code className="rounded bg-amber-100 px-1 font-mono text-xs">ENCRYPTION_KEY</code> no Coolify (64 hex chars).
            </p>
          </div>
        </div>
      )}

      {/* Configurable integrations */}
      <div className="space-y-2">
        {configurableIntegrations.map((key) => (
          <IntegrationCard
            key={key}
            id={key}
            status={data[key]}
            onConfigure={() => setOpenDialog(key)}
            onTest={() => handleTest(key)}
            testing={testing === key}
            testResult={testResults[key] ?? null}
          />
        ))}
      </div>

      {/* Read-only integrations (env only) */}
      <div className="space-y-2">
        {readonlyIntegrations.map((key) => (
          <IntegrationCard
            key={key}
            id={key}
            status={data[key]}
            onTest={() => handleTest(key)}
            testing={testing === key}
            testResult={testResults[key] ?? null}
          />
        ))}
      </div>

      <p className="text-[10px] text-muted-foreground">
        <Lock className="mr-1 inline h-3 w-3" />
        Tokens salvos no banco são criptografados com AES-256-GCM.
        Env vars têm prioridade somente se nenhuma chave for salva no banco.
      </p>

      {/* Dialogs */}
      <TinyDialog
        open={openDialog === 'tiny'}
        onClose={() => setOpenDialog(null)}
        onSave={(token) => configure({ integration: 'tiny', token })}
        onDelete={() => handleDelete('tiny')}
        hasExisting={data.tiny.configured && data.tiny.source === 'db'}
        saving={saving}
      />

      <ShopifyDialog
        open={openDialog === 'shopify'}
        onClose={() => setOpenDialog(null)}
        onSave={(storeUrl, token) => configure({ integration: 'shopify', storeUrl, token })}
        onDelete={() => handleDelete('shopify')}
        hasExisting={data.shopify.configured && data.shopify.source === 'db'}
        existingUrl={data.shopify.storeUrl}
        saving={saving}
      />

      <NuvemshopDialog
        open={openDialog === 'nuvemshop'}
        onClose={() => setOpenDialog(null)}
        onSave={(storeId, token) => configure({ integration: 'nuvemshop', storeId, token })}
        onDelete={() => handleDelete('nuvemshop')}
        hasExisting={data.nuvemshop.configured && data.nuvemshop.source === 'db'}
        existingStoreId={data.nuvemshop.storeId}
        saving={saving}
      />
    </div>
  );
}
