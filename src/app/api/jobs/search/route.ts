import { NextRequest, NextResponse } from 'next/server';
import { create } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob } from '@/lib/types';
import { enqueueJob } from '@/lib/queue';
import { z } from 'zod';

const SearchJobSchema = z.object({
  queries: z.array(
    z.object({
      termo: z.string().min(2).max(200),
      tipo: z.enum(['sem_variacao', 'com_variacao']).default('sem_variacao'),
    })
  ).min(1).max(20),
});

/**
 * Create processing jobs from search terms (no NF required).
 * Each term creates one job that searches, scrapes, and generates a product draft.
 */
export async function POST(request: NextRequest) {
  try {
    const raw = await request.json();
    const parsed = SearchJobSchema.safeParse(raw);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Dados inválidos', details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const now = new Date().toISOString();
    const createdJobs: ProcessingJob[] = [];

    for (const query of parsed.data.queries) {
      // Create audit log entry — no nf_import_id, search term stored in item_ids as JSON
      const auditRow = await create<ProcessingJob>(TABLES.PROCESSING_JOBS, {
        user_id: 'admin',
        nf_import_id: 'search', // Special marker for search-based jobs
        tipo: query.tipo,
        status: 'pendente',
        item_ids: JSON.stringify({ search_term: query.termo }), // Store search term
        grupo_id: null,
        created_at: now,
        updated_at: now,
      });
      createdJobs.push(auditRow);

      // Enqueue with search term as input
      await enqueueJob({
        jobId: auditRow.Id,
        nfImportId: 'search',
        tipo: query.tipo,
        itemIds: [], // No NF items
        grupoId: query.termo, // Reuse grupoId field to pass the search term
      });
    }

    return NextResponse.json({
      success: true,
      count: createdJobs.length,
      jobs: createdJobs,
    });
  } catch (error) {
    console.error('Search job error:', error instanceof Error ? error.message : error);
    return NextResponse.json(
      { error: 'Erro ao criar jobs de pesquisa' },
      { status: 500 }
    );
  }
}
