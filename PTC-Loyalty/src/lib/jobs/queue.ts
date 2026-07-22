/**
 * Minimal async job abstraction.
 *
 * The default driver runs handlers in-process, fire-and-forget, with bounded
 * retries and exponential backoff. It is intentionally small so it can be
 * swapped for a durable queue (BullMQ, Upstash QStash, SQS, …) without touching
 * call sites: keep `enqueue()` / `registerJob()` and replace the driver body.
 *
 * Contract:
 *  - `enqueue()` returns immediately and NEVER throws to the caller. A failing
 *    job can therefore never roll back or fail the business transaction that
 *    scheduled it.
 *  - Handlers are idempotent by design (see WhatsApp service): retries are safe.
 */

export interface JobHandlerContext {
  attempt: number; // 1-based
  maxAttempts: number;
}

export type JobHandler<T> = (
  payload: T,
  ctx: JobHandlerContext,
) => Promise<void>;

interface JobDefinition {
  handler: JobHandler<unknown>;
  maxAttempts: number;
  backoffMs: number;
}

const registry = new Map<string, JobDefinition>();

export interface RegisterOptions {
  maxAttempts?: number;
  backoffMs?: number;
}

/** Register a job handler once (module load). */
export function registerJob<T>(
  name: string,
  handler: JobHandler<T>,
  options: RegisterOptions = {},
): void {
  registry.set(name, {
    handler: handler as JobHandler<unknown>,
    maxAttempts: options.maxAttempts ?? 3,
    backoffMs: options.backoffMs ?? 1000,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runWithRetries(
  name: string,
  def: JobDefinition,
  payload: unknown,
): Promise<void> {
  for (let attempt = 1; attempt <= def.maxAttempts; attempt++) {
    try {
      await def.handler(payload, { attempt, maxAttempts: def.maxAttempts });
      return;
    } catch (err) {
      const last = attempt === def.maxAttempts;
      // eslint-disable-next-line no-console
      console.error(
        `[jobs] "${name}" attempt ${attempt}/${def.maxAttempts} failed${last ? " (giving up)" : ", retrying"}:`,
        err instanceof Error ? err.message : err,
      );
      if (last) return;
      await sleep(def.backoffMs * attempt); // linear-ish backoff
    }
  }
}

/**
 * Schedule a job. Fire-and-forget: resolves immediately, swallows all errors.
 *
 * In a serverless runtime, in-process background work may be cut off after the
 * response is sent. When deploying to Vercel, wrap the driver in `waitUntil()`
 * or switch to QStash/BullMQ — the swap point is right here.
 */
export function enqueue<T>(name: string, payload: T): void {
  const def = registry.get(name);
  if (!def) {
    // eslint-disable-next-line no-console
    console.error(`[jobs] no handler registered for "${name}"`);
    return;
  }
  // Detach from the caller's promise chain so it can't affect the caller.
  void Promise.resolve().then(() => runWithRetries(name, def, payload));
}

/** Await a job inline (used by tests / synchronous contexts). */
export async function runNow<T>(name: string, payload: T): Promise<void> {
  const def = registry.get(name);
  if (!def) throw new Error(`No handler registered for "${name}"`);
  await runWithRetries(name, def, payload);
}
