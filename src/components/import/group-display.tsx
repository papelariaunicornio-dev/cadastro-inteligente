'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X } from 'lucide-react';
import { useImportStore } from '@/store/import-store';

export function GroupDisplay() {
  const {
    activeTab,
    groups,
    items,
    pendingGroupSelection,
    confirmGroup,
    removeGroup,
  } = useImportStore();

  if (activeTab !== 'multiplos_itens') return null;

  return (
    <div className="space-y-3">
      {/* Confirm group button */}
      <div className="flex items-center gap-3">
        <Button
          size="sm"
          variant="outline"
          disabled={pendingGroupSelection.size < 2}
          onClick={confirmGroup}
        >
          Confirmar grupo ({pendingGroupSelection.size} itens)
        </Button>
        {groups.length > 0 && (
          <span className="text-sm text-muted-foreground">
            {groups.length} grupo{groups.length !== 1 ? 's' : ''} confirmado
            {groups.length !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Confirmed groups */}
      {groups.map((group) => {
        const groupItems = items.filter((item) =>
          group.itemIds.includes(item.Id)
        );
        const descriptions = groupItems
          .map((i) => i.descricao)
          .join(', ');

        return (
          <div
            key={group.id}
            className="flex items-start gap-3 rounded-lg border border-purple-200 bg-purple-50 p-3"
          >
            <Badge
              variant="secondary"
              className="shrink-0 bg-purple-200 text-purple-800"
            >
              {group.name}:
            </Badge>
            <p className="flex-1 text-sm text-purple-900 line-clamp-2">
              {descriptions}
            </p>
            <Button
              size="sm"
              variant="ghost"
              className="shrink-0 text-red-600 hover:text-red-700"
              onClick={() => removeGroup(group.id)}
            >
              <X className="h-4 w-4" />
              Remover
            </Button>
          </div>
        );
      })}
    </div>
  );
}
