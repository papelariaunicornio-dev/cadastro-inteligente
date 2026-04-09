'use client';

import { useImportStore } from '@/store/import-store';
import { XmlDropzone } from '@/components/import/xml-dropzone';
import { NfHeader } from '@/components/import/nf-header';
import { SelectionTabs } from '@/components/import/selection-tabs';
import { GroupDisplay } from '@/components/import/group-display';
import { ItemsTable } from '@/components/import/items-table';
import { NextStepButton } from '@/components/import/next-step-button';

export default function ImportPage() {
  const nfImport = useImportStore((s) => s.nfImport);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Importar XML</h1>

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
