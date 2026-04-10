/**
 * Next.js instrumentation — runs once on server startup.
 * Used to start the BullMQ worker for background job processing.
 */

export async function register() {
  // Only run on server side, not during build
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { startWorker } = await import('./lib/queue');
    await startWorker();
  }
}
