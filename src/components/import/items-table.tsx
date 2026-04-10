'use client';

import { useState } from 'react';
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
import { ArrowUp, ArrowDown, ArrowUpDown } from 'lucide-react';
import { useImportStore } from '@/store/import-store';
import { cn } from '@/lib/utils';
import type { NfItem } from '@/lib/types';

function formatCurrency(value: number): string {
  return `R$ ${value.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

type SortKey = 'codigo' | 'ean' | 'descricao' | 'quantidade' | 'unidades_por_item' | 'valor_unitario' | 'valor_ipi' | 'valor_total';
type SortDir = 'asc' | 'desc';

function getSortValue(item: NfItem, key: SortKey): string | number {
  if (key === 'valor_total') {
    return Number(item.valor_produto) + Number(item.valor_ipi);
  }
  const val = item[key as keyof NfItem];
  if (val == null) return '';
  return typeof val === 'number' ? val : String(val).toLowerCase();
}

function SortIcon({ column, sortKey, sortDir }: { column: SortKey; sortKey: SortKey | null; sortDir: SortDir }) {
  if (sortKey !== column) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-muted-foreground/40" />;
  return sortDir === 'asc'
    ? <ArrowUp className="ml-1 inline h-3 w-3 text-primary" />
    : <ArrowDown className="ml-1 inline h-3 w-3 text-primary" />;
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

  const [sortKey, setSortKey] = useState<SortKey | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  if (items.length === 0) return null;

  const isMultiplosTab = activeTab === 'multiplos_itens';

  // Sort items
  const sortedItems = [...items];
  if (sortKey) {
    sortedItems.sort((a, b) => {
      const aVal = getSortValue(a, sortKey);
      const bVal = getSortValue(b, sortKey);
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  // Find which group an item belongs to (for numbering)
  const getGroupIndex = (itemId: number): number | null => {
    const idx = groups.findIndex((g) => g.itemIds.includes(itemId));
    return idx >= 0 ? idx + 1 : null;
  };

  const headerClass = 'cursor-pointer select-none hover:text-foreground transition-colors';

  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-12"></TableHead>
            <TableHead className={headerClass} onClick={() => handleSort('codigo')}>
              Código <SortIcon column="codigo" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={headerClass} onClick={() => handleSort('ean')}>
              EAN <SortIcon column="ean" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={cn('max-w-[300px]', headerClass)} onClick={() => handleSort('descricao')}>
              Produto <SortIcon column="descricao" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={cn('text-center', headerClass)} onClick={() => handleSort('quantidade')}>
              Qtd <SortIcon column="quantidade" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className="text-center">Und/Item</TableHead>
            <TableHead className={cn('text-right', headerClass)} onClick={() => handleSort('valor_unitario')}>
              V. Unit. <SortIcon column="valor_unitario" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={cn('text-right', headerClass)} onClick={() => handleSort('valor_ipi')}>
              IPI <SortIcon column="valor_ipi" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
            <TableHead className={cn('text-right', headerClass)} onClick={() => handleSort('valor_total')}>
              V. Total <SortIcon column="valor_total" sortKey={sortKey} sortDir={sortDir} />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedItems.map((item) => {
            const classification = selections.get(item.Id);
            const isSelected = classification === activeTab;
            const isInGroup = groups.some((g) =>
              g.itemIds.includes(item.Id)
            );
            const isPendingGroup = pendingGroupSelection.has(item.Id);
            const isOtherTab =
              classification != null && classification !== activeTab;

            const isLocked =
              (!isMultiplosTab && isInGroup) ||
              (isMultiplosTab && isInGroup);

            const showCheck = isMultiplosTab ? isPendingGroup : isSelected;
            const groupNum = getGroupIndex(item.Id);

            const handleRowClick = (e: React.MouseEvent) => {
              if ((e.target as HTMLElement).closest('input')) return;
              if (isLocked) return;
              if (isMultiplosTab) {
                togglePendingGroup(item.Id);
              } else {
                toggleItem(item.Id);
              }
            };

            return (
              <TableRow
                key={item.Id}
                onClick={handleRowClick}
                className={cn(
                  'cursor-pointer',
                  isSelected && 'bg-blue-50',
                  isPendingGroup && isMultiplosTab && 'bg-purple-50',
                  isLocked && 'opacity-50 cursor-not-allowed',
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
                      {classification === 'multiplos_itens' && (
                        <>G{groupNum}</>
                      )}
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
                  {formatCurrency(Number(item.valor_produto) + Number(item.valor_ipi))}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
