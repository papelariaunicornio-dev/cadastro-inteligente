'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Plus, X, Globe, ExternalLink, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import type { UserSettings } from '@/lib/types';

interface ConcorrentesSectionProps {
  settings: Partial<UserSettings>;
  update: (field: string, value: unknown) => void;
}

interface SiteConcorrente {
  url: string;
  nome: string;
}

/**
 * Auto-saves sites_concorrentes to the API whenever the list changes.
 */
async function autoSave(sites: SiteConcorrente[]) {
  try {
    await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sites_concorrentes: JSON.stringify(sites) }),
    });
  } catch {
    // Will be saved when user clicks global Save button
  }
}

export function ConcorrentesSection({ settings, update }: ConcorrentesSectionProps) {
  const [newUrl, setNewUrl] = useState('');
  const [newNome, setNewNome] = useState('');
  const [saving, setSaving] = useState(false);

  const sites: SiteConcorrente[] = (() => {
    try {
      return JSON.parse(settings.sites_concorrentes || '[]');
    } catch {
      return [];
    }
  })();

  const addSite = async () => {
    let url = newUrl.trim();
    if (!url) return;

    if (!url.startsWith('http')) url = `https://${url}`;
    let nome = newNome.trim();
    if (!nome) {
      try {
        nome = new URL(url).hostname.replace('www.', '');
      } catch {
        nome = url;
      }
    }

    if (sites.some((s) => s.url === url)) {
      toast.error('Site j\u00e1 adicionado');
      return;
    }

    setSaving(true);
    const updated = [...sites, { url, nome }];
    const json = JSON.stringify(updated);
    update('sites_concorrentes', json);
    await autoSave(updated);
    setNewUrl('');
    setNewNome('');
    setSaving(false);
    toast.success(`${nome} adicionado`);
  };

  const removeSite = async (index: number) => {
    const updated = sites.filter((_, i) => i !== index);
    const json = JSON.stringify(updated);
    update('sites_concorrentes', json);
    await autoSave(updated);
    toast.success('Site removido');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addSite();
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5" />
          Sites Concorrentes e Refer{'\u00ea'}ncias
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Adicione sites para comparar pre{'\u00e7'}os e buscar informa{'\u00e7\u00f5'}es dos produtos.
          O sistema busca automaticamente nesses sites durante o processamento.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add new site */}
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="flex-1 space-y-1">
            <Label className="text-xs">URL do site</Label>
            <Input
              value={newUrl}
              onChange={(e) => setNewUrl(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="kalunga.com.br"
            />
          </div>
          <div className="w-full sm:w-48 space-y-1">
            <Label className="text-xs">Nome (opcional)</Label>
            <Input
              value={newNome}
              onChange={(e) => setNewNome(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Kalunga"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={addSite} disabled={!newUrl.trim() || saving} size="sm" className="w-full sm:w-auto">
              {saving ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
              Adicionar
            </Button>
          </div>
        </div>

        {/* Sites list */}
        {sites.length > 0 ? (
          <div className="space-y-2">
            {sites.map((site, i) => (
              <div
                key={i}
                className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30"
              >
                <Globe className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{site.nome}</p>
                  <a
                    href={site.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-primary hover:underline flex items-center gap-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {site.url}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-8 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                  onClick={() => removeSite(i)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum site adicionado. Exemplos: kalunga.com.br, grafittiartes.com.br
          </p>
        )}
      </CardContent>
    </Card>
  );
}
