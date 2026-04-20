/**
 * Job queue using BullMQ + Redis.
 *
 * Architecture:
 * - BullMQ is the SOURCE OF TRUTH for job state, progress, and intermediate data
 * - NocoDB stores only the final product_draft (output) and a slim audit log
 * - Redis holds: queue position, status, progress, intermediate scraping data
 * - No business data in the DB queue table — just audit trail
 *
 * Falls back to inline processing if Redis is unavailable (dev only).
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

const QUEUE_NAME = 'product-processing';

let connection: IORedis | null = null;
let queue: Queue | null = null;
let worker: Worker | null = null;
let redisAvailable: boolean | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

// ==========================================
// Connection management
// ==========================================

async function ensureConnection(): Promise<boolean> {
  if (redisAvailable === true && connection) return true;
  if (redisAvailable === false) return false;

  try {
    connection = new IORedis(getRedisUrl(), {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      connectTimeout: 3000,
    });
    await connection.connect();
    redisAvailable = true;
    console.log('[Queue] Redis connected');
    return true;
  } catch {
    redisAvailable = false;
    connection = null;
    console.warn('[Queue] Redis not available — using inline processing');
    return false;
  }
}

async function getQueue(): Promise<Queue | null> {
  if (queue) return queue;
  if (!(await ensureConnection()) || !connection) return null;
  queue = new Queue(QUEUE_NAME, { connection });
  return queue;
}

// ==========================================
// Job data types (stored in Redis, not DB)
// ==========================================

export interface JobInput {
  jobId: number;               // Audit log ID in NocoDB
  nfImportId: string;
  tipo: string;
  itemIds: number[];
  grupoId: string | null;
  userId: string;              // Owner — username (= user_id in all tables)
}

export interface JobProgress {
  step: 'pendente' | 'pesquisando' | 'scraping' | 'buscando_imagens' | 'gerando' | 'concluido' | 'erro';
  message?: string;
  // Intermediate data lives HERE, not in the DB
  searchResults?: {
    brand: string;
    urls: { marca: string[]; ecommerce: string[]; marketplace: string[] };
    totalUrls: number;
  };
  scrapingResults?: {
    pagesScraped: number;
    summaries: {
      url: string;
      tipo: string;
      titulo?: string;
      preco?: number;
      hasDescription: boolean;
      imageCount: number;
    }[];
  };
  imagesFound?: number;
  aiGenerated?: boolean;
  priceCalculated?: boolean;
  draftCreated?: boolean;
  error?: string;
}

// ==========================================
// Worker
// ==========================================

export async function startWorker(): Promise<void> {
  if (worker) return;
  if (!(await ensureConnection()) || !connection) return;

  // Dynamic import to avoid circular dependency
  const { processJobFromQueue } = await import('./processing/pipeline');

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job<JobInput>) => {
      console.log(`[Worker] Processing job ${job.data.jobId}...`);
      await processJobFromQueue(job);
    },
    {
      connection,
      concurrency: 1,
      limiter: {
        max: 1,
        duration: 2000,
      },
    }
  );

  worker.on('completed', (job) => {
    console.log(`[Worker] Job ${job.data.jobId} completed`);
  });

  worker.on('failed', (job, err) => {
    console.error(`[Worker] Job ${job?.data?.jobId} failed:`, err.message);
  });

  console.log('[Worker] Started and listening for jobs');
}

// ==========================================
// Producer
// ==========================================

export async function enqueueJob(input: JobInput): Promise<string | null> {
  const q = await getQueue();

  if (q) {
    const job = await q.add(
      `process-${input.jobId}`,
      input,
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 200 },
        removeOnFail: { count: 100 },
      }
    );
    console.log(`[Queue] Job ${input.jobId} enqueued as ${job.id}`);
    return job.id || null;
  } else {
    // Fallback: inline fire-and-forget (dev only)
    console.log(`[Queue] Fallback: processing job ${input.jobId} inline`);
    const { processJobInline } = await import('./processing/pipeline');
    processJobInline(input).catch((err) =>
      console.error(`[Queue] Inline job ${input.jobId} failed:`, err)
    );
    return null;
  }
}

// ==========================================
// Job status queries (read from BullMQ/Redis)
// ==========================================

export async function getJobStatus(bullmqJobId: string): Promise<JobProgress | null> {
  const q = await getQueue();
  if (!q) return null;

  const job = await q.getJob(bullmqJobId);
  if (!job) return null;

  const state = await job.getState();
  const progress = (job.progress || {}) as JobProgress;

  // Map BullMQ state to our step
  if (state === 'completed') {
    return { ...progress, step: 'concluido' };
  }
  if (state === 'failed') {
    return { ...progress, step: 'erro', error: job.failedReason || 'Unknown error' };
  }
  if (state === 'waiting' || state === 'delayed') {
    return { step: 'pendente' };
  }

  return progress;
}

export async function getAllJobStatuses(): Promise<{
  jobId: number;
  bullmqId: string;
  state: string;
  progress: JobProgress;
  input: JobInput;
  timestamp: number;
  duration: number;
}[]> {
  const q = await getQueue();
  if (!q) return [];

  // Get all jobs (active, waiting, completed, failed)
  const [active, waiting, completed, failed] = await Promise.all([
    q.getJobs(['active'], 0, 50),
    q.getJobs(['waiting', 'delayed'], 0, 50),
    q.getJobs(['completed'], 0, 50),
    q.getJobs(['failed'], 0, 50),
  ]);

  const allJobs = [...active, ...waiting, ...completed, ...failed];

  const results = await Promise.all(
    allJobs.map(async (job) => {
      const state = await job.getState();
      const progress = (job.progress || { step: 'pendente' }) as JobProgress;

      if (state === 'completed') progress.step = 'concluido';
      if (state === 'failed') {
        progress.step = 'erro';
        progress.error = job.failedReason || undefined;
      }
      if (state === 'waiting' || state === 'delayed') progress.step = 'pendente';

      return {
        jobId: job.data.jobId,
        bullmqId: job.id || '',
        state,
        progress,
        input: job.data,
        timestamp: job.timestamp,
        duration: job.finishedOn
          ? job.finishedOn - job.processedOn!
          : job.processedOn
          ? Date.now() - job.processedOn
          : 0,
      };
    })
  );

  // Sort by timestamp desc
  return results.sort((a, b) => b.timestamp - a.timestamp);
}

export async function retryJob(bullmqJobId: string): Promise<boolean> {
  const q = await getQueue();
  if (!q) return false;

  const job = await q.getJob(bullmqJobId);
  if (!job) return false;

  await job.retry();
  return true;
}
