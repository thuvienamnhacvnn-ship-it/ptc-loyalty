import { saveQueueRaw, loadQueueRaw } from "./secure-store";
import { authed } from "./session";
import type { ApiResult } from "./api-client";
import type { PosTransactionResult } from "@shared/contract";

// ─────────────────────────────────────────────────────────────────────────────
// Encrypted offline queue for EARN transactions that could not be sent because
// the counter lost internet. Design rules (per spec):
//   • We NEVER report a queued transaction as "successful" — it is "pending".
//   • Each item carries a client idempotencyKey; re-sync is therefore safe and
//     the server de-duplicates, so a double-send cannot double-award points.
//   • Sync is explicit: staff must confirm before pending items are flushed.
// ─────────────────────────────────────────────────────────────────────────────

export interface QueuedEarn {
  id: string; // local id (also used as fallback idempotency key)
  idempotencyKey: string;
  customerId: string;
  customerName: string;
  amount: number;
  receiptRef: string | null;
  branchId: string | null;
  createdAt: number;
  lastError?: string;
}

let cache: QueuedEarn[] | null = null;

async function read(): Promise<QueuedEarn[]> {
  if (cache) return cache;
  const raw = await loadQueueRaw();
  cache = raw ? (JSON.parse(raw) as QueuedEarn[]) : [];
  return cache;
}

async function write(items: QueuedEarn[]): Promise<void> {
  cache = items;
  await saveQueueRaw(JSON.stringify(items));
}

export async function list(): Promise<QueuedEarn[]> {
  return read();
}

export async function count(): Promise<number> {
  return (await read()).length;
}

export async function enqueue(item: QueuedEarn): Promise<void> {
  const items = await read();
  // Guard against enqueuing the same idempotencyKey twice.
  if (items.some((i) => i.idempotencyKey === item.idempotencyKey)) return;
  items.push(item);
  await write(items);
}

export async function remove(id: string): Promise<void> {
  const items = (await read()).filter((i) => i.id !== id);
  await write(items);
}

export interface SyncOutcome {
  total: number;
  synced: number;
  failed: number;
  stillOffline: boolean;
}

/**
 * Flush the queue. Each item is sent with its original idempotencyKey; if the
 * server already recorded it (e.g. a partial earlier attempt), it returns the
 * existing result and we drop the item — no duplicate award.
 */
export async function sync(baseUrl: string): Promise<SyncOutcome> {
  const items = await read();
  let synced = 0;
  let failed = 0;
  let stillOffline = false;

  for (const item of items) {
    const res: ApiResult<PosTransactionResult> = await authed<PosTransactionResult>(
      baseUrl,
      "/api/pos/transactions/earn",
      {
        method: "POST",
        branchId: item.branchId,
        body: {
          customerId: item.customerId,
          amount: item.amount,
          receiptRef: item.receiptRef ?? undefined,
          idempotencyKey: item.idempotencyKey,
          branchId: item.branchId ?? undefined,
        },
      },
    );

    if (res.ok) {
      await remove(item.id);
      synced++;
    } else if (res.offline) {
      // Network still down — stop; keep the rest queued.
      stillOffline = true;
      break;
    } else {
      // A definitive server rejection (e.g. receipt_reused). Keep it flagged so
      // staff can review; do not silently drop.
      item.lastError = res.error;
      await write(await read());
      failed++;
    }
  }

  return { total: items.length, synced, failed, stillOffline };
}
