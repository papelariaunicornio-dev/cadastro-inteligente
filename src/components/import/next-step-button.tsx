'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2 } from 'lucide-react';
import { useImportStore } from '@/store/import-store';
import type { ItemClassification } from '@/lib/types';

export function NextStepButton() {
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();
  const { nfImport, selections, groups, canProceed } = useImportStore();

  const handleClick = async () => {
    if (!nfImport || !canProceed()) return;

    setSubmitting(true);

    try {
      // 1. Save selections
      const selectionItems = Array.from(selections.entries()).map(
        ([itemId, classificacao]) => ({
          itemId,
          classificacao,
          grupoId:
            classificacao === 'multiplos_itens'
              ? groups.find((g) => g.itemIds.includes(itemId))?.id ?? null
              : null,
        })
      );

      await fetch(`/api/nf/${nfImport.Id}/select`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selections: selectionItems }),
      });

      // 2. Create processing jobs
      const jobs: {
        tipo: ItemClassification;
        itemIds: number[];
        grupoId: string | null;
      }[] = [];

      // Jobs for sem_variacao items (1 job per item)
      for (const [itemId, cls] of selections) {
        if (cls === 'sem_variacao') {
          jobs.push({ tipo: 'sem_variacao', itemIds: [itemId], grupoId: null });
        }
      }

      // Jobs for com_variacao items (1 job per item)
      for (const [itemId, cls] of selections) {
        if (cls === 'com_variacao') {
          jobs.push({ tipo: 'com_variacao', itemIds: [itemId], grupoId: null });
        }
      }

      // Jobs for multiplos_itens groups (1 job per group)
      for (const group of groups) {
        jobs.push({
          tipo: 'multiplos_itens',
          itemIds: group.itemIds,
          grupoId: group.id,
        });
      }

      await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nfImportId: String(nfImport.Id),
          jobs,
        }),
      });

      // 3. Navigate to products page
      router.push('/products');
    } catch (error) {
      console.error('Error submitting:', error);
    } finally {
      setSubmitting(false);
    }
  };

  const selectedCount = selections.size;

  return (
    <div className="flex items-center justify-between rounded-lg border bg-white p-4">
      <p className="text-sm text-muted-foreground">
        {selectedCount === 0
          ? 'Selecione pelo menos 1 item para continuar'
          : `${selectedCount} item${selectedCount !== 1 ? 's' : ''} selecionado${selectedCount !== 1 ? 's' : ''}`}
      </p>
      <Button
        size="lg"
        disabled={!canProceed() || submitting}
        onClick={handleClick}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processando...
          </>
        ) : (
          <>
            Próxima etapa
            <ArrowRight className="ml-2 h-4 w-4" />
          </>
        )}
      </Button>
    </div>
  );
}
