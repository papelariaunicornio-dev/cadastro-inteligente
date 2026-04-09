'use client';

import { useImportStore } from '@/store/import-store';
import { XmlDropzone } from '@/components/import/xml-dropzone';
import { NfHeader } from '@/components/import/nf-header';
import { SelectionTabs } from '@/components/import/selection-tabs';
import { GroupDisplay } from '@/components/import/group-display';
import { ItemsTable } from '@/components/import/items-table';
import { NextStepButton } from '@/components/import/next-step-button';
import { Button } from '@/components/ui/button';
import { RotateCcw } from 'lucide-react';

export default function ImportPage() {
  const nfImport = useImportStore((s) => s.nfImport);
  const reset = useImportStore((s) => s.reset);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Importar XML</h1>
          <p className="text-sm text-muted-foreground">
            {nfImport
              ? 'Selecione os produtos e o tipo de cadastro'
              : 'Envie o XML da Nota Fiscal para começar'}
          </p>
        </div>
        {nfImport && (
          <Button variant="outline" size="sm" onClick={reset}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Nova importação
          </Button>
        )}
      </div>

      {!nfImport ? (
        <XmlDropzone />
      ) : (
        <>
          <NfHeader />
          <SelectionTabs />
          <GroupDisplay />
          <ItemsTable />
          <NextStepButton />
        </>
      )}
    </div>
  );
}
