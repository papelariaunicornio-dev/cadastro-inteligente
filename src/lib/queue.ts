/**
 * Job queue using BullMQ + Redis.
 * Falls back to inline processing if Redis is not available (dev/MVP).
 *
 * Architecture:
 * - Producer: API routes add jobs to the queue
 * - Consumer: Worker processes jobs from the queue
 * - This keeps job processing decoupled from HTTP request lifecycle
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';
import { processJob } from './processing/pipeline';

const QUEUE_NAME = 'product-processing';

let connection: IORedis | null = null;
let queue: Queue | null = null;
let worker: Worker | null = null;
let redisAvailable: boolean | null = null;

function getRedisUrl(): string {
  return process.env.REDIS_URL || 'redis://localhost:6379';
}

/**
 * Try to connect to Redis. Returns false if unavailable.
 */
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

/**
 * Get or create the BullMQ queue.
 */
async function getQueue(): Promise<Queue | null> {
  if (queue) return queue;
  if (!(await ensureConnection()) || !connection) return null;

  queue = new Queue(QUEUE_NAME, { connection });
  return queue;
}

/**
 * Start the worker that processes jobs from the queue.
 * Called once on server startup.
 */
export async function startWorker(): Promise<void> {
  if (worker) return;
  if (!(await ensureConnection()) || !connection) return;

  worker = new Worker(
    QUEUE_NAME,
    async (job: Job) => {
      const { jobId } = job.data as { jobId: number };
      console.log(`[Worker] Processing job ${jobId}...`);
      await processJob(jobId);
    },
    {
      connection,
      concurrency: 1, // Process one at a time to respect API rate limits
      limiter: {
        max: 1,
        duration: 2000, // Max 1 job per 2 seconds
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

/**
 * Add a job to the queue.
 * Falls back to inline processing if Redis is unavailable.
 */
export async function enqueueJob(jobId: number): Promise<void> {
  const q = await getQueue();

  if (q) {
    await q.add(
      `process-${jobId}`,
      { jobId },
      {
        attempts: 2,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 50,
      }
    );
    console.log(`[Queue] Job ${jobId} enqueued`);
  } else {
    // Fallback: inline fire-and-forget
    console.log(`[Queue] Fallback: processing job ${jobId} inline`);
    processJob(jobId).catch((err) =>
      console.error(`[Queue] Inline job ${jobId} failed:`, err)
    );
  }
}

/**
 * Add multiple jobs to the queue.
 */
export async function enqueueJobs(jobIds: number[]): Promise<void> {
  for (const jobId of jobIds) {
    await enqueueJob(jobId);
  }
}
