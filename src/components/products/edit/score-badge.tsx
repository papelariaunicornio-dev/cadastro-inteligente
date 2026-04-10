'use client';

import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';

interface ScoreBadgeProps {
  label: string;
  score: number | null;
  status: string | null;
  flags?: { severity: string; message: string }[];
  suggestions?: string[];
  compact?: boolean;
}

const STATUS_COLORS: Record<string, string> = {
  otimo: 'bg-green-100 text-green-800 border-green-300',
  bom: 'bg-blue-100 text-blue-800 border-blue-300',
  atencao: 'bg-amber-100 text-amber-800 border-amber-300',
  critico: 'bg-red-100 text-red-800 border-red-300',
};

const STATUS_ICONS: Record<string, React.ElementType> = {
  otimo: CheckCircle2,
  bom: CheckCircle2,
  atencao: AlertTriangle,
  critico: XCircle,
};

export function ScoreBadge({ label, score, status, flags, suggestions, compact }: ScoreBadgeProps) {
  if (score === null || status === null) return null;

  const colorClass = STATUS_COLORS[status] || STATUS_COLORS.atencao;
  const StatusIcon = STATUS_ICONS[status] || AlertCircle;

  if (compact) {
    return (
      <Badge variant="outline" className={cn('gap-1 text-[10px]', colorClass)}>
        <StatusIcon className="h-3 w-3" />
        {score}
      </Badge>
    );
  }

  const criticalFlags = (flags || []).filter((f) => f.severity === 'critica' || f.severity === 'alta');

  return (
    <div className="space-y-1.5">
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground">{label}</span>
        <Badge variant="outline" className={cn('gap-1', colorClass)}>
          <StatusIcon className="h-3 w-3" />
          {score}/100
        </Badge>
      </div>
      {criticalFlags.length > 0 && (
        <div className="space-y-0.5">
          {criticalFlags.map((f, i) => (
            <p key={i} className="text-[10px] text-red-600 flex items-center gap-1">
              <AlertCircle className="h-3 w-3 shrink-0" />
              {f.message}
            </p>
          ))}
        </div>
      )}
      {suggestions && suggestions.length > 0 && (
        <div className="space-y-0.5">
          {suggestions.slice(0, 2).map((s, i) => (
            <p key={i} className="text-[10px] text-amber-600">
              💡 {s}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
