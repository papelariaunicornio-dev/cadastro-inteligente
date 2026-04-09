'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import {
  Loader2,
  AlertCircle,
  CheckCircle2,
  Search,
  Globe,
  Image,
  Sparkles,
  Clock,
  RotateCcw,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  FileText,
  AlertTriangle,
  Filter,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ==========================================
// Types
// ==========================================
interface UrlClassification {
  marca: string[];
  ecommerce: string[];
  marketplace: string[];
}

interface ScrapingSummary {
  url: string;
  tipo: string;
  titulo?: string;
  preco?: number;
  hasDescription: boolean;
  imageCount: number;
}

interface DetailedJob {
  id: number;
  status: string;
  tipo: string;
  erro_mensagem: string | null;
  created_at: string;
  updated_at: string;
  duration_seconds: number;
  nf: { numero_nf: string; fornecedor: string } | null;
  items: string[];
  item_count: number;
  urls_encontradas: UrlClassification | null;
  dados_scraping: ScrapingSummary[] | null;
  has_prompt: boolean;
  has_response: boolean;
}

interface Summary {
  total: number;
  pendente: number;
  pesquisando: number;
  scraping: number;
  buscando_imagens: number;
  gerando: number;
  concluido: number;
  erro: number;
}

// ==========================================
// Constants
// ==========================================
const STATUS_CONFIG: Record<string, {
  label: string;
  icon: React.ElementType;
  color: string;
  bgColor: string;
  badgeVariant: 'default' | 'secondary' | 'outline' | 'destructive';
}> = {
  pendente: { label: 'Na fila', icon: Clock, color: 'text-gray-500', bgColor: 'bg-gray-50', badgeVariant: 'outline' },
  pesquisando: { label: 'Buscando na web', icon: Search, color: 'text-blue-600', bgColor: 'bg-blue-50', badgeVariant: 'default' },
  scraping: { label: 'Extraindo dados', icon: Globe, color: 'text-indigo-600', bgColor: 'bg-indigo-50', badgeVariant: 'default' },
  buscando_imagens: { label: 'Buscando imagens', icon: Image, color: 'text-purple-600', bgColor: 'bg-purple-50', badgeVariant: 'default' },
  gerando: { label: 'Gerando com IA', icon: Sparkles, color: 'text-amber-600', bgColor: 'bg-amber-50', badgeVariant: 'default' },
  concluido: { label: 'Concluído', icon: CheckCircle2, color: 'text-green-600', bgColor: 'bg-green-50', badgeVariant: 'secondary' },
  erro: { label: 'Erro', icon: AlertCircle, color: 'text-red-600', bgColor: 'bg-red-50', badgeVariant: 'destructive' },
};

const TIPO_LABEL: Record<string, string> = {
  sem_variacao: 'Sem variação',
  com_variacao: 'Com variação',
  multiplos_itens: 'Múltiplos itens',
};

const STEPS = ['pendente', 'pesquisando', 'scraping', 'buscando_imagens', 'gerando', 'concluido'];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  return `${min}m ${sec}s`;
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}

// ==========================================
// Step Progress Component
// ==========================================
function StepProgress({ currentStatus }: { currentStatus: string }) {
  const currentIdx = STEPS.indexOf(currentStatus);
  const isError = currentStatus === 'erro';

  return (
    <div className="flex items-center gap-1">
      {STEPS.map((step, i) => {
        const isDone = currentIdx > i;
        const isCurrent = currentIdx === i;
        const config = STATUS_CONFIG[step];

        return (
          <div key={step} className="flex items-center gap-1">
            <div
              className={cn(
                'flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold transition-all',
                isDone && 'bg-green-500 text-white',
                isCurrent && !isError && 'bg-primary text-white ring-2 ring-primary/30',
                isCurrent && isError && 'bg-red-500 text-white ring-2 ring-red-300',
                !isDone && !isCurrent && 'bg-gray-200 text-gray-400'
              )}
              title={config?.label || step}
            >
              {isDone ? '✓' : i + 1}
            </div>
            {i < STEPS.length - 1 && (
              <div
                className={cn(
                  'h-0.5 w-4',
                  isDone ? 'bg-green-400' : 'bg-gray-200'
                )}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ==========================================
// Job Detail Card
// ==========================================
function JobCard({
  job,
  onRetry,
}: {
  job: DetailedJob;
  onRetry: (id: number) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const config = STATUS_CONFIG[job.status] || STATUS_CONFIG.pendente;
  const Icon = config.icon;
  const isActive = !['concluido', 'erro', 'pendente'].includes(job.status);
  const totalUrls = job.urls_encontradas
    ? (job.urls_encontradas.marca?.length || 0) +
      (job.urls_encontradas.ecommerce?.length || 0) +
      (job.urls_encontradas.marketplace?.length || 0)
    : 0;

  return (
    <Card className={cn('transition-all', config.bgColor, 'border-l-4', {
      'border-l-gray-300': job.status === 'pendente',
      'border-l-blue-400': job.status === 'pesquisando',
      'border-l-indigo-400': job.status === 'scraping',
      'border-l-purple-400': job.status === 'buscando_imagens',
      'border-l-amber-400': job.status === 'gerando',
      'border-l-green-400': job.status === 'concluido',
      'border-l-red-400': job.status === 'erro',
    })}>
      {/* Header — always visible */}
      <div
        className="flex items-center gap-3 p-4 cursor-pointer"
        onClick={() => setExpanded((v) => !v)}
      >
        {expanded ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}

        <Icon className={cn('h-5 w-5 shrink-0', config.color, isActive && 'animate-pulse')} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-sm">{config.label}</span>
            <Badge variant={config.badgeVariant} className="text-[10px]">
              {TIPO_LABEL[job.tipo] || job.tipo}
            </Badge>
            {job.nf && (
              <span className="text-xs text-muted-foreground">
                NF {job.nf.numero_nf} · {job.nf.fornecedor}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground truncate mt-0.5">
            {job.items.length > 0
              ? job.items.slice(0, 2).join(' | ') + (job.items.length > 2 ? ` +${job.items.length - 2}` : '')
              : `${job.item_count} item(s)`}
          </p>
        </div>

        <StepProgress currentStatus={job.status} />

        <div className="text-right shrink-0 ml-2">
          <p className="text-xs font-mono text-muted-foreground">
            {formatDuration(job.duration_seconds)}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {formatTime(job.updated_at)}
          </p>
        </div>

        {job.status === 'erro' && (
          <Button
            variant="outline"
            size="sm"
            className="shrink-0 ml-2"
            onClick={(e) => {
              e.stopPropagation();
              onRetry(job.id);
            }}
          >
            <RotateCcw className="mr-1 h-3 w-3" />
            Retry
          </Button>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3">
          {/* Error message */}
          {job.erro_mensagem && (
            <div className="flex items-start gap-2 rounded-md bg-red-100 p-3 text-sm text-red-800">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
              <pre className="whitespace-pre-wrap text-xs font-mono flex-1">{job.erro_mensagem}</pre>
            </div>
          )}

          {/* Items */}
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Itens ({job.items.length})</p>
            <div className="space-y-0.5">
              {job.items.map((desc, i) => (
                <p key={i} className="text-xs text-foreground/80">• {desc}</p>
              ))}
            </div>
          </div>

          {/* URLs encontradas */}
          {job.urls_encontradas && totalUrls > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                URLs encontradas ({totalUrls})
              </p>
              <div className="grid gap-2 sm:grid-cols-3">
                {job.urls_encontradas.marca?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-blue-700 mb-0.5">
                      Marca ({job.urls_encontradas.marca.length})
                    </p>
                    {job.urls_encontradas.marca.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-blue-600 hover:underline block truncate">
                        {(() => { try { return new URL(url).hostname; } catch { return url; } })()}
                        <ExternalLink className="inline h-2 w-2 ml-0.5" />
                      </a>
                    ))}
                  </div>
                )}
                {job.urls_encontradas.ecommerce?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-green-700 mb-0.5">
                      E-commerce ({job.urls_encontradas.ecommerce.length})
                    </p>
                    {job.urls_encontradas.ecommerce.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-green-600 hover:underline block truncate">
                        {(() => { try { return new URL(url).hostname; } catch { return url; } })()}
                        <ExternalLink className="inline h-2 w-2 ml-0.5" />
                      </a>
                    ))}
                  </div>
                )}
                {job.urls_encontradas.marketplace?.length > 0 && (
                  <div>
                    <p className="text-[10px] font-semibold text-orange-700 mb-0.5">
                      Marketplace ({job.urls_encontradas.marketplace.length})
                    </p>
                    {job.urls_encontradas.marketplace.map((url, i) => (
                      <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                        className="text-[10px] text-orange-600 hover:underline block truncate">
                        {(() => { try { return new URL(url).hostname; } catch { return url; } })()}
                        <ExternalLink className="inline h-2 w-2 ml-0.5" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Scraping results */}
          {job.dados_scraping && job.dados_scraping.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-muted-foreground mb-1">
                Dados extraídos ({job.dados_scraping.length} páginas)
              </p>
              <div className="space-y-1">
                {job.dados_scraping.map((d, i) => (
                  <div key={i} className="flex items-center gap-2 text-[11px]">
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {d.tipo}
                    </Badge>
                    <span className="truncate flex-1">{d.titulo || d.url}</span>
                    {d.preco && (
                      <span className="font-mono text-green-700 shrink-0">
                        R$ {d.preco.toFixed(2)}
                      </span>
                    )}
                    {d.imageCount > 0 && (
                      <span className="text-muted-foreground shrink-0">
                        {d.imageCount} img
                      </span>
                    )}
                    {d.hasDescription && (
                      <FileText className="h-3 w-3 text-muted-foreground shrink-0" />
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* AI status */}
          <div className="flex gap-4 text-xs">
            <span className={cn('flex items-center gap-1', job.has_prompt ? 'text-green-600' : 'text-gray-400')}>
              {job.has_prompt ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              Prompt enviado
            </span>
            <span className={cn('flex items-center gap-1', job.has_response ? 'text-green-600' : 'text-gray-400')}>
              {job.has_response ? <CheckCircle2 className="h-3 w-3" /> : <Clock className="h-3 w-3" />}
              Resposta IA
            </span>
          </div>

          {/* Timestamps */}
          <div className="text-[10px] text-muted-foreground flex gap-4">
            <span>Criado: {formatTime(job.created_at)}</span>
            <span>Atualizado: {formatTime(job.updated_at)}</span>
            <span>Duração: {formatDuration(job.duration_seconds)}</span>
          </div>
        </div>
      )}
    </Card>
  );
}

// ==========================================
// Main Page
// ==========================================
export default function ProcessingPage() {
  const [jobs, setJobs] = useState<DetailedJob[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [resetting, setResetting] = useState(false);
  const [filter, setFilter] = useState<string>('all');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/jobs/detailed');
      const data = await res.json();
      setJobs(data.list || []);
      setSummary(data.summary || null);
    } catch (error) {
      console.error('Fetch error:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleResetStuck = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/jobs/reset-stuck', { method: 'POST' });
      const data = await res.json();
      toast.success(data.message);
      fetchData();
    } catch {
      toast.error('Erro ao resetar');
    } finally {
      setResetting(false);
    }
  };

  const handleRetry = async (jobId: number) => {
    try {
      await fetch(`/api/jobs/${jobId}/retry`, { method: 'POST' });
      toast.success(`Job ${jobId} reenviado para processamento`);
      fetchData();
    } catch {
      toast.error('Erro ao reprocessar');
    }
  };

  const filteredJobs = filter === 'all'
    ? jobs
    : jobs.filter((j) => j.status === filter);

  const hasStuckOrPending = jobs.some(
    (j) => j.status === 'pendente' || (!['concluido', 'erro'].includes(j.status) && j.duration_seconds > 300)
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Processamento</h1>
          <p className="text-sm text-muted-foreground">
            Acompanhe o status detalhado de cada job
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleResetStuck}
          disabled={resetting}
        >
          {resetting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RotateCcw className="mr-2 h-4 w-4" />
          )}
          Reprocessar travados
        </Button>
      </div>

      {/* Summary cards */}
      {summary && (
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-4 lg:grid-cols-7">
          {Object.entries(STATUS_CONFIG).map(([key, config]) => {
            const count = summary[key as keyof Summary] ?? 0;
            const Icon = config.icon;
            const isActive = filter === key;
            return (
              <Card
                key={key}
                className={cn(
                  'cursor-pointer transition-all hover:shadow-md',
                  isActive && 'ring-2 ring-primary'
                )}
                onClick={() => setFilter(isActive ? 'all' : key)}
              >
                <CardContent className="flex items-center gap-2 p-3">
                  <Icon className={cn('h-4 w-4', config.color)} />
                  <div>
                    <p className="text-lg font-bold leading-none">{count as number}</p>
                    <p className="text-[10px] text-muted-foreground">{config.label}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Filter indicator */}
      {filter !== 'all' && (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">
            Filtrado por: <strong>{STATUS_CONFIG[filter]?.label}</strong>
          </span>
          <Button variant="ghost" size="sm" onClick={() => setFilter('all')}>
            Limpar filtro
          </Button>
        </div>
      )}

      <Separator />

      {/* Jobs list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredJobs.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            {filter !== 'all'
              ? 'Nenhum job com esse status'
              : 'Nenhum job de processamento encontrado. Importe um XML para começar.'}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredJobs.map((job) => (
            <JobCard key={job.id} job={job} onRetry={handleRetry} />
          ))}
        </div>
      )}

      {/* Stuck warning */}
      {hasStuckOrPending && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">
                Existem jobs pendentes ou possivelmente travados
              </p>
              <p className="text-xs text-amber-600">
                Clique em &quot;Reprocessar travados&quot; para resetar e reprocessar automaticamente.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
