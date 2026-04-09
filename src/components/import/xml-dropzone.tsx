'use client';

import { useCallback, useState } from 'react';
import { Upload, FileText, AlertCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useImportStore } from '@/store/import-store';

export function XmlDropzone() {
  const [isDragOver, setIsDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { setNfData, setLoading, loading } = useImportStore();

  const processFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith('.xml')) {
        setError('Apenas arquivos .xml são aceitos');
        return;
      }

      setError(null);
      setLoading(true);

      try {
        const formData = new FormData();
        formData.append('xml', file);

        const res = await fetch('/api/nf/upload', {
          method: 'POST',
          body: formData,
        });

        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Erro ao processar XML');
          return;
        }

        setNfData(data.nfImport, data.items);
      } catch {
        setError('Erro de conexão ao processar XML');
      } finally {
        setLoading(false);
      }
    },
    [setNfData, setLoading]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);

      const file = e.dataTransfer.files[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  const handleFileInput = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) processFile(file);
    },
    [processFile]
  );

  return (
    <Card>
      <CardContent className="p-8">
        <div
          className={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
            isDragOver
              ? 'border-blue-500 bg-blue-50'
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragOver(true);
          }}
          onDragLeave={() => setIsDragOver(false)}
          onDrop={handleDrop}
        >
          {loading ? (
            <>
              <FileText className="mb-4 h-12 w-12 animate-pulse text-blue-500" />
              <p className="text-lg font-medium text-gray-700">
                Processando XML...
              </p>
            </>
          ) : (
            <>
              <Upload className="mb-4 h-12 w-12 text-gray-400" />
              <p className="mb-2 text-lg font-medium text-gray-700">
                Arraste o XML da NF-e aqui
              </p>
              <p className="mb-4 text-sm text-gray-500">
                ou clique para selecionar
              </p>
              <Button
                variant="outline"
                onClick={() => {
                  const input = document.createElement('input');
                  input.type = 'file';
                  input.accept = '.xml';
                  input.onchange = (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) processFile(file);
                  };
                  input.click();
                }}
              >
                Selecionar arquivo
              </Button>
            </>
          )}
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-md bg-red-50 p-3 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            {error}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
