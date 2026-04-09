'use client';

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useImportStore } from '@/store/import-store';
import { cn } from '@/lib/utils';

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

export function ItemsTable() {
  const {
    items,
    activeTab,
    selections,
    groups,
    pendingGroupSelection,
    toggleItem,
    togglePendingGroup,
    setUndItem,
  } = useImportStore();

  if (items.length === 0) return null;

  const isMultiplosTab = activeTab === 'multiplos_itens';

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead>Código</TableHead>
            <TableHead>EAN</TableHead>
            <TableHead className="max-w-[300px]">Produto</TableHead>
            <TableHead className="text-center">Qtd</TableHead>
            <TableHead className="text-center">Und/Item</TableHead>
            <TableHead className="text-right">V. Unit.</TableHead>
            <TableHead className="text-right">IPI</TableHead>
            <TableHead className="text-right">V. Total</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((item) => {
            const classification = selections.get(item.Id);
            const isSelected = classification === activeTab;
            const isInGroup = groups.some((g) =>
              g.itemIds.includes(item.Id)
            );
            const isPendingGroup = pendingGroupSelection.has(item.Id);
            const isOtherTab =
              classification != null && classification !== activeTab;

            // Locked: in a group on non-multiplos tab, or classified differently
            const isLocked =
              (!isMultiplosTab && isInGroup) ||
              (isMultiplosTab && isInGroup);

            const showCheck = isMultiplosTab ? isPendingGroup : isSelected;

            return (
              <TableRow
                key={item.Id}
                className={cn(
                  isSelected && 'bg-blue-50',
                  isPendingGroup && isMultiplosTab && 'bg-purple-50',
                  isLocked && 'opacity-50',
                  isOtherTab && !isLocked && 'opacity-70'
                )}
              >
                <TableCell>
                  <Checkbox
                    checked={showCheck}
                    disabled={isLocked}
                    onCheckedChange={() => {
                      if (isMultiplosTab) {
                        togglePendingGroup(item.Id);
                      } else {
                        toggleItem(item.Id);
                      }
                    }}
                  />
                </TableCell>
                <TableCell className="font-mono text-sm">
                  {item.codigo}
                </TableCell>
                <TableCell className="font-mono text-xs text-muted-foreground">
                  {item.ean || '—'}
                </TableCell>
                <TableCell className="max-w-[300px]">
                  <span className="text-sm">{item.descricao}</span>
                  {classification && (
                    <Badge
                      variant="outline"
                      className={cn(
                        'ml-2 text-[10px]',
                        classification === 'sem_variacao' &&
                          'border-green-300 text-green-700',
                        classification === 'com_variacao' &&
                          'border-blue-300 text-blue-700',
                        classification === 'multiplos_itens' &&
                          'border-purple-300 text-purple-700'
                      )}
                    >
                      {classification === 'sem_variacao' && 'sem var.'}
                      {classification === 'com_variacao' && 'com var.'}
                      {classification === 'multiplos_itens' && 'grupo'}
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="text-center">
                  {item.quantidade}
                </TableCell>
                <TableCell className="text-center">
                  <Input
                    type="number"
                    min={1}
                    value={item.unidades_por_item}
                    onChange={(e) =>
                      setUndItem(item.Id, parseInt(e.target.value, 10) || 1)
                    }
                    className="mx-auto w-16 text-center"
                  />
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(Number(item.valor_unitario))}
                </TableCell>
                <TableCell className="text-right text-sm">
                  {formatCurrency(Number(item.valor_ipi))}
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {formatCurrency(Number(item.valor_total))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
