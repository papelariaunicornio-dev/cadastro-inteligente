import { NextRequest, NextResponse } from 'next/server';
import { processJob } from '@/lib/processing/pipeline';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ jobId: string }> }
) {
  const { jobId } = await params;

  // Fire-and-forget
  processJob(parseInt(jobId, 10)).catch((err) =>
    console.error(`[Process] Job ${jobId} error:`, err)
  );

  return NextResponse.json({ success: true, message: `Job ${jobId} processing started` });
}
