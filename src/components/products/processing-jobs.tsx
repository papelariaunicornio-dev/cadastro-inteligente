'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Loader2, AlertCircle, CheckCircle2, Search, Globe, Image,
  Sparkles, ChevronDown, ChevronRight, RotateCcw, Square, Trash2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ProcessingJob } from '@/lib/types';

const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  animate?: boolean;
}> = {
  pendente: { label: 'Na fila', icon: Loader2, color: 'text-gray-400' },
  pesquisando: { label: 'Buscando na web...', icon: Search, color: 'text-blue-500', animate: true },
  scraping: { label: 'Extraindo dados...', icon: Globe, color: 'text-indigo-500', animate: true },
  buscando_imagens: { label: 'Buscando imagens...', icon: Image, color: 'text-purple-500', animate: true },
  gerando: { label: 'Gerando com IA...', icon: Sparkles, color: 'text-amber-500', animate: true },
  concluido: { label: 'Concluido', icon: CheckCircle2, color: 'text-green-500' },
  erro: { label: 'Erro', icon: AlertCircle, color: 'text-red-500' },
};

const TIPO_LABEL: Record<string, string> = {
  sem_variacao: 'Sem variacao',
  com_variacao: 'Com variacao',
  multiplos_itens: 'Multiplos itens',
};

export function ProcessingJobs() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const fetchJobs = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs');
      const data = await res.json();
      setJobs(data.list || []);
    } catch (error) {
      console.error('Fetch jobs error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
    const hasActive = jobs.some(
      (j) => !['concluido', 'erro'].includes(j.status)
    );
    const interval = setInterval(fetchJobs, hasActive ? 3000 : 10000);
    return () => clearInterval(interval);
  }, [fetchJobs, jobs]);

  const activeJobs = jobs.filter((j) => !['concluido', 'erro'].includes(j.status));
  const errorJobs = jobs.filter((j) => j.status === 'erro');

  const handleResetStuck = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/jobs/reset-stuck', { method: 'POST' });
      const data = await res.json();
      toast.success(data.message || 'Jobs resetados');
      fetchJobs();
    } catch {
      toast.error('Erro ao resetar jobs');
    } finally {
      setResetting(false);
    }
  };

  const handleStopAll = async () => {
    if (!confirm('Parar todos os processamentos em andamento?')) return;
    setStopping(true);
    try {
      const res = await fetch('/api/jobs/stop-all', { method: 'POST' });
      const data = await res.json();
      toast.success(data.message || 'Jobs parados');
      fetchJobs();
    } catch {
      toast.error('Erro ao parar jobs');
    } finally {
      setStopping(false);
    }
  };

  const handleDeleteJob = async (jobId: number) => {
    setDeletingId(jobId);
    try {
      const res = await fetch(`/api/jobs/${jobId}/delete`, { method: 'DELETE' });
      const data = await res.json();
      toast.success(data.message || 'Job deletado');
      fetchJobs();
    } catch {
      toast.error('Erro ao deletar job');
    } finally {
      setDeletingId(null);
    }
  };

  if (loading || (activeJobs.length === 0 && errorJobs.length === 0)) return null;

  const allJobs = [...activeJobs, ...errorJobs];

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle
            className="flex items-center gap-2 text-base cursor-pointer select-none"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4 text-amber-600" />
            ) : (
              <ChevronRight className="h-4 w-4 text-amber-600" />
            )}
            {activeJobs.length > 0 && (
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
            )}
            {activeJobs.length > 0
              ? `Processando ${activeJobs.length} produto${activeJobs.length !== 1 ? 's' : ''}...`
              : `${errorJobs.length} job${errorJobs.length !== 1 ? 's' : ''} com erro`}
          </CardTitle>
          <div className="flex gap-2">
            {activeJobs.length > 0 && (
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStopAll}
                disabled={stopping}
              >
                {stopping ? (
                  <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                ) : (
                  <Square className="mr-1 h-3 w-3" />
                )}
                Parar tudo
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleResetStuck}
              disabled={resetting}
            >
              {resetting ? (
                <Loader2 className="mr-1 h-3 w-3 animate-spin" />
              ) : (
                <RotateCcw className="mr-1 h-3 w-3" />
              )}
              Reprocessar
            </Button>
          </div>
        </div>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-2">
            {allJobs.map((job) => {
              const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pendente;
              const Icon = config.icon;
              let itemInfo = '';
              try {
                const parsed = JSON.parse(job.item_ids || '[]');
                if (parsed.search_term) {
                  itemInfo = `Pesquisa: "${parsed.search_term}"`;
                } else if (Array.isArray(parsed)) {
                  itemInfo = `${parsed.length} item${parsed.length !== 1 ? 's' : ''}`;
                }
              } catch {
                itemInfo = '';
              }

              return (
                <div
                  key={job.Id}
                  className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm"
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${config.color} ${config.animate ? 'animate-pulse' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {TIPO_LABEL[job.tipo] || job.tipo}
                      {itemInfo && ` · ${itemInfo}`}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] shrink-0">
                    {job.status}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 w-7 p-0 shrink-0 text-muted-foreground hover:text-red-600"
                    disabled={deletingId === job.Id}
                    onClick={() => handleDeleteJob(job.Id)}
                    title="Deletar job e produto"
                  >
                    {deletingId === job.Id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5" />
                    )}
                  </Button>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
