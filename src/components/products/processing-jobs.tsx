'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, AlertCircle, CheckCircle2, Search, Globe, Image, Sparkles, ChevronDown, ChevronRight } from 'lucide-react';
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
  concluido: { label: 'Concluído', icon: CheckCircle2, color: 'text-green-500' },
  erro: { label: 'Erro', icon: AlertCircle, color: 'text-red-500' },
};

const TIPO_LABEL: Record<string, string> = {
  sem_variacao: 'Sem variação',
  com_variacao: 'Com variação',
  multiplos_itens: 'Múltiplos itens',
};

export function ProcessingJobs() {
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

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

  if (loading || activeJobs.length === 0) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/50">
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded((v) => !v)}
      >
        <CardTitle className="flex items-center gap-2 text-base">
          {expanded ? (
            <ChevronDown className="h-4 w-4 text-amber-600" />
          ) : (
            <ChevronRight className="h-4 w-4 text-amber-600" />
          )}
          <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
          Processando {activeJobs.length} produto{activeJobs.length !== 1 ? 's' : ''}...
        </CardTitle>
      </CardHeader>
      {expanded && (
        <CardContent>
          <div className="space-y-2">
            {activeJobs.map((job) => {
              const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pendente;
              const Icon = config.icon;
              const itemIds: number[] = job.item_ids ? JSON.parse(job.item_ids) : [];

              return (
                <div
                  key={job.Id}
                  className="flex items-center gap-3 rounded-lg bg-white p-3 shadow-sm"
                >
                  <Icon
                    className={`h-5 w-5 ${config.color} ${config.animate ? 'animate-pulse' : ''}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{config.label}</p>
                    <p className="text-xs text-muted-foreground">
                      {TIPO_LABEL[job.tipo] || job.tipo} · {itemIds.length} item{itemIds.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {job.status}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
