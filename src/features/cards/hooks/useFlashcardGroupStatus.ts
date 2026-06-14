/**
 * useFlashcardGroupStatus / useSetFlashcardGroupStatus — Phase 5 hooks.
 *
 * Read path: `user_flashcard_group_status` indexed by `(user_id, status_group_uid)`.
 * Write path: outbox → background drain → idempotent RPC.
 *
 * The hooks are ADDITIVE. They do not replace `useFavorites`, `useRedList`,
 * `useSetFavoriteGroup`, or `useSetRedListGroup`. Call-site migration is a
 * separate, gradual pass tracked in `.lovable/plan.md`.
 */

import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { enqueue, latestForGroup } from "../lib/statusOutbox";
import { drainUser } from "../lib/statusDrainer";

export type GroupStatusSyncState = "salvo" | "salvando" | "aguardando" | "erro";

export interface GroupStatusValue {
  isFavorite: boolean;
  isRedList: boolean;
  syncState: GroupStatusSyncState;
  lastError?: string | null;
}

function emptyValue(): GroupStatusValue {
  return { isFavorite: false, isRedList: false, syncState: "salvo" };
}

/**
 * Reads the confirmed server state for a single (user, status_group_uid) pair
 * and overlays any pending outbox operation so the UI reflects the user's
 * latest intent even before the drainer reaches the network.
 */
export function useFlashcardGroupStatus(statusGroupUid: string | null | undefined) {
  const { userId, status } = useAuth();
  const enabled = !!userId && !!statusGroupUid && status === "authenticated";

  return useQuery<GroupStatusValue>({
    queryKey: ["flashcard-group-status", userId, statusGroupUid],
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      if (!userId || !statusGroupUid) return emptyValue();

      const { data, error } = await (supabase as any)
        .from("user_flashcard_group_status")
        .select("is_favorite,is_red_list,last_operation_id")
        .eq("user_id", userId)
        .eq("status_group_uid", statusGroupUid)
        .maybeSingle();

      if (error) throw error;

      const server: GroupStatusValue = data
        ? {
            isFavorite: !!data.is_favorite,
            isRedList: !!data.is_red_list,
            syncState: "salvo",
          }
        : emptyValue();

      // Overlay pending outbox intent (if any) so the UI is consistent.
      try {
        const pending = await latestForGroup(userId, statusGroupUid);
        if (pending && pending.last_operation_id !== data?.last_operation_id) {
          return {
            isFavorite: pending.isFavorite,
            isRedList: pending.isRedList,
            syncState: pending.state === "failed" ? "erro" : "aguardando",
            lastError: pending.lastError,
          };
        }
      } catch {
        // IndexedDB unavailable (SSR / private mode) → just return server view.
      }

      return server;
    },
  });
}

export interface SetGroupStatusInput {
  statusGroupUid: string;
  isFavorite: boolean;
  isRedList: boolean;
}

/**
 * Mutation: enqueue the requested status in the outbox, optimistically update
 * the per-group cache, then trigger a background drain. NO network call is
 * issued from `onMutate`.
 */
export function useSetFlashcardGroupStatus() {
  const { userId } = useAuth();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (input: SetGroupStatusInput) => {
      if (!userId) throw new Error("Não autenticado");
      // Enforce the server invariant locally so the optimistic value matches
      // what the RPC will persist.
      const isFavorite = input.isFavorite;
      const isRedList = input.isRedList && isFavorite;
      const operationId = crypto.randomUUID();

      await enqueue({
        operationId,
        userId,
        statusGroupUid: input.statusGroupUid,
        isFavorite,
        isRedList,
      });

      // Optimistic per-group update (scoped, not broad invalidation).
      qc.setQueryData<GroupStatusValue>(
        ["flashcard-group-status", userId, input.statusGroupUid],
        { isFavorite, isRedList, syncState: "aguardando" },
      );

      // Fire-and-forget drain. We do not await it: that's the whole point of
      // the outbox. The query refetch in onSettled reconciles the final state.
      void drainUser(userId).catch(() => {
        // Drain errors are recorded in the outbox; nothing to do here.
      });

      return { operationId, isFavorite, isRedList };
    },
    onSettled: (_data, _err, vars) => {
      if (!userId) return;
      qc.invalidateQueries({
        queryKey: ["flashcard-group-status", userId, vars.statusGroupUid],
      });
    },
  });
}