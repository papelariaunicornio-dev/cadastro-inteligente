'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Search,
  Plus,
  X,
  Loader2,
  ArrowRight,
  Sparkles,
} from 'lucide-react';
import { toast } from 'sonner';

interface SearchItem {
  id: number;
  termo: string;
  tipo: 'sem_variacao' | 'com_variacao';
}

let nextId = 1;

export default function SearchPage() {
  const router = useRouter();
  const [currentTerm, setCurrentTerm] = useState('');
  const [items, setItems] = useState<SearchItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const addItem = () => {
    const termo = currentTerm.trim();
    if (!termo) return;
    if (termo.length < 2) {
      toast.error('Termo muito curto (mínimo 2 caracteres)');
      return;
    }
    setItems((prev) => [...prev, { id: nextId++, termo, tipo: 'sem_variacao' }]);
    setCurrentTerm('');
  };

  const removeItem = (id: number) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
  };

  const toggleTipo = (id: number) => {
    setItems((prev) =>
      prev.map((i) =>
        i.id === id
          ? { ...i, tipo: i.tipo === 'sem_variacao' ? 'com_variacao' : 'sem_variacao' }
          : i
      )
    );
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      addItem();
    }
  };

  const handleSubmit = async () => {
    if (items.length === 0) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/jobs/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          queries: items.map((i) => ({ termo: i.termo, tipo: i.tipo })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error || 'Erro ao criar pesquisas');
        return;
      }

      toast.success(`${data.count} produto(s) enviado(s) para processamento`);
      router.push('/processing');
    } catch {
      toast.error('Erro de conexão');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Cadastro por Pesquisa</h1>
        <p className="text-sm text-muted-foreground">
          Digite o nome do produto e a plataforma pesquisa e cadastra automaticamente
        </p>
      </div>

      {/* Input area */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Search className="h-5 w-5 text-primary" />
            Pesquisar produtos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={currentTerm}
              onChange={(e) => setCurrentTerm(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ex: Caneta Pentel Energel 0.5mm azul"
              className="flex-1 h-11"
              autoFocus
            />
            <Button onClick={addItem} disabled={!currentTerm.trim()} className="h-11">
              <Plus className="mr-1 h-4 w-4" />
              Adicionar
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Pressione Enter para adicionar. Seja específico: inclua marca, modelo, cor, tamanho.
          </p>
        </CardContent>
      </Card>

      {/* Items list */}
      {items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Produtos para pesquisar ({items.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30"
                >
                  <Sparkles className="h-4 w-4 text-primary shrink-0" />
                  <span className="flex-1 text-sm font-medium">{item.termo}</span>
                  <Badge
                    variant="outline"
                    className="cursor-pointer select-none"
                    onClick={() => toggleTipo(item.id)}
                  >
                    {item.tipo === 'sem_variacao' ? 'Sem variação' : 'Com variação'}
                  </Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-8 p-0 text-muted-foreground hover:text-red-600"
                    onClick={() => removeItem(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>

            <Separator className="my-4" />

            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {items.length} produto{items.length !== 1 ? 's' : ''} — clique no badge para alternar tipo
              </p>
              <Button
                onClick={handleSubmit}
                disabled={submitting}
                size="lg"
                className="bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <ArrowRight className="mr-2 h-4 w-4" />
                )}
                Pesquisar e cadastrar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How it works */}
      <Card>
        <CardContent className="p-6">
          <p className="text-sm font-medium mb-3">Como funciona:</p>
          <ol className="space-y-2 text-sm text-muted-foreground">
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">1</span>
              Você digita o nome do produto (quanto mais específico, melhor)
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">2</span>
              A plataforma pesquisa na web (marca, e-commerce, marketplaces)
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">3</span>
              Extrai dados, imagens e preços das páginas encontradas
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">4</span>
              IA gera o cadastro completo (título, descrição, SEO, preço)
            </li>
            <li className="flex gap-2">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">5</span>
              Você revisa, edita e aprova em Produtos
            </li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
