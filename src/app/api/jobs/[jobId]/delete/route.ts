import { NextRequest, NextResponse } from 'next/server';
import { get, remove, list } from '@/lib/nocodb';
import { TABLES } from '@/lib/nocodb-tables';
import type { ProcessingJob, ProductDraft } from '@/lib/types';

/**
 * Delete a job and its associated product draft.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;
  const id = parseInt(jobId, 10);

  try {
    // Find and delete associated product_draft
    const drafts = await list<ProductDraft>(TABLES.PRODUCT_DRAFTS, {
      where: `(job_id,eq,${id})`,
      limit: 10,
    });

    for (const draft of drafts.list) {
      await remove(TABLES.PRODUCT_DRAFTS, draft.Id);
    }

    // Delete the job itself
    await remove(TABLES.PROCESSING_JOBS, id);

    return NextResponse.json({
      success: true,
      deletedDrafts: drafts.list.length,
      message: `Job ${jobId} e ${drafts.list.length} produto(s) deletado(s)`,
    });
  } catch (error) {
    console.error('Delete job error:', error instanceof Error ? error.message : error);
    return NextResponse.json({ error: 'Erro ao deletar job' }, { status: 500 });
  }
}
