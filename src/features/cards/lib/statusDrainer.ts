/**
 * statusDrainer — pushes pending outbox operations to the
 * `set_flashcard_group_status` RPC, with idempotency provided by `operationId`.
 *
 * Invariants:
 *   - Only one drain runs at a time per user (in-process mutex).
 *   - Failures are recorded; pending operations are NOT silently discarded.
 *   - The RPC is idempotent: replaying the same `operationId` is safe.
 */

import { supabase } from "@/integrations/supabase/client";
import {
  listPendingForUser,
  markFailed,
  markInflight,
  markSuccess,
  type OutboxOp,
} from "./statusOutbox";

const inflightUsers = new Set<string>();

export interface DrainResult {
  attempted: number;
  succeeded: number;
  failed: number;
  skippedNoSession: boolean;
}

export async function drainUser(userId: string): Promise<DrainResult> {
  if (inflightUsers.has(userId)) {
    return { attempted: 0, succeeded: 0, failed: 0, skippedNoSession: false };
  }
  inflightUsers.add(userId);
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session || session.user.id !== userId) {
      return { attempted: 0, succeeded: 0, failed: 0, skippedNoSession: true };
    }
    const pending = await listPendingForUser(userId);
    let succeeded = 0;
    let failed = 0;
    for (const op of pending) {
      const ok = await pushOne(op);
      if (ok) succeeded++; else failed++;
    }
    return { attempted: pending.length, succeeded, failed, skippedNoSession: false };
  } finally {
    inflightUsers.delete(userId);
  }
}

async function pushOne(op: OutboxOp): Promise<boolean> {
  await markInflight(op.operationId);
  try {
    const { error } = await (supabase as any).rpc("set_flashcard_group_status", {
      p_status_group_uid: op.statusGroupUid,
      p_is_favorite: op.isFavorite,
      p_is_red_list: op.isRedList,
      p_operation_id: op.operationId,
    });
    if (error) {
      await markFailed(op.operationId, error.message ?? String(error));
      return false;
    }
    await markSuccess(op.operationId);
    return true;
  } catch (err: any) {
    await markFailed(op.operationId, err?.message ?? String(err));
    return false;
  }
}