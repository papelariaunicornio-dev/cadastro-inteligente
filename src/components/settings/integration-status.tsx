'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Loader2, Shield } from 'lucide-react';

interface IntegrationInfo {
  configured: boolean;
  label: string;
  envVar?: string;
  envVars?: string[];
  storeUrl?: string | null;
}

interface IntegrationsData {
  tiny: IntegrationInfo;
  shopify: IntegrationInfo;
  firecrawl: IntegrationInfo;
  openai: IntegrationInfo;
}

export function IntegrationStatus() {
  const [data, setData] = useState<IntegrationsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/integrations/status')
      .then((r) => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-4">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data) return null;

  const integrations = [
    { key: 'openai', ...data.openai },
    { key: 'firecrawl', ...data.firecrawl },
    { key: 'tiny', ...data.tiny },
    { key: 'shopify', ...data.shopify },
  ];

  return (
    <div className="space-y-3">
      {integrations.map((integration) => (
        <div
          key={integration.key}
          className="flex items-center justify-between rounded-lg border p-3"
        >
          <div className="flex items-center gap-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-sm font-medium">{integration.label}</p>
              <p className="text-[10px] font-mono text-muted-foreground">
                {integration.envVars
                  ? integration.envVars.join(', ')
                  : integration.envVar}
              </p>
              {integration.storeUrl && (
                <p className="text-[10px] text-muted-foreground">
                  {integration.storeUrl}
                </p>
              )}
            </div>
          </div>
          {integration.configured ? (
            <Badge variant="secondary" className="gap-1 bg-green-100 text-green-800">
              <CheckCircle2 className="h-3 w-3" />
              Configurado
            </Badge>
          ) : (
            <Badge variant="outline" className="gap-1 text-muted-foreground">
              <XCircle className="h-3 w-3" />
              Não configurado
            </Badge>
          )}
        </div>
      ))}
      <p className="text-[10px] text-muted-foreground mt-2">
        Para configurar, defina as variáveis de ambiente no Coolify e faça redeploy.
      </p>
    </div>
  );
}
