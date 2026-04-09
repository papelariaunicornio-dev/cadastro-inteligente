'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useImportStore } from '@/store/import-store';
import { cn } from '@/lib/utils';

const tabs = [
  {
    key: 'sem_variacao' as const,
    label: 'Sem variações',
    color: 'bg-green-100 text-green-800',
  },
  {
    key: 'com_variacao' as const,
    label: 'Com variações',
    color: 'bg-blue-100 text-blue-800',
  },
  {
    key: 'multiplos_itens' as const,
    label: 'Múltiplos itens',
    color: 'bg-purple-100 text-purple-800',
  },
];

export function SelectionTabs() {
  const { activeTab, setActiveTab, selections, groups } = useImportStore();

  // Count items per classification
  const counts: Record<string, number> = {
    sem_variacao: 0,
    com_variacao: 0,
    multiplos_itens: 0,
  };
  for (const [, cls] of selections) {
    counts[cls]++;
  }

  return (
    <div className="flex items-center gap-2 rounded-lg bg-gray-100 p-1">
      {tabs.map((tab) => {
        const isActive = activeTab === tab.key;
        const count =
          tab.key === 'multiplos_itens'
            ? `${groups.length} grupos`
            : counts[tab.key];

        return (
          <Button
            key={tab.key}
            variant="ghost"
            className={cn(
              'flex-1 gap-2 rounded-md py-2',
              isActive && 'bg-white shadow-sm'
            )}
            onClick={() => setActiveTab(tab.key)}
          >
            <span className={cn(isActive && 'font-semibold')}>
              {tab.label}
            </span>
            {(typeof count === 'number' ? count > 0 : count !== '0 grupos') && (
              <Badge variant="secondary" className={cn('text-xs', tab.color)}>
                {count}
              </Badge>
            )}
          </Button>
        );
      })}
    </div>
  );
}
