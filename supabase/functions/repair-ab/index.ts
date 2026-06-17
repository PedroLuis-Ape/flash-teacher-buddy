import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  MAX_REPAIR_BODY_BYTES,
  isRepairAction,
  isSafeOptionalText,
  isUuid,
  normalizeCardIds,
} from "./validation.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function relationOwnerId(value: unknown): string | null {
  if (Array.isArray(value)) return (value[0] as { owner_id?: string } | undefined)?.owner_id ?? null;
  return (value as { owner_id?: string } | null)?.owner_id ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().includes("application/json")) {
    return json({ error: "Content-Type must be application/json" }, 415);
  }

  const declaredLength = Number(req.headers.get("content-length") ?? 0);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_REPAIR_BODY_BYTES) {
    return json({ error: "Request body too large" }, 413);
  }

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");
    if (!supabaseUrl || !serviceRoleKey || !anonKey) throw new Error("Missing server configuration");

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Unauthorized" }, 401);

    let body: Record<string, unknown>;
    try {
      body = await req.json();
    } catch {
      return json({ error: "Invalid JSON body" }, 400);
    }

    const { action } = body;
    if (!isRepairAction(action)) return json({ error: "Invalid action" }, 400);

    const listId = body.list_id;
    if (listId !== undefined && !isUuid(listId)) return json({ error: "Invalid list_id" }, 400);

    if (listId) {
      const { data: list, error: listError } = await admin
        .from("lists")
        .select("owner_id")
        .eq("id", listId)
        .maybeSingle();
      if (listError) throw listError;
      if (!list || list.owner_id !== user.id) return json({ error: "Permission denied" }, 403);
    }

    switch (action) {
      case "swap_cards": {
        const cardIds = normalizeCardIds(body.card_ids);
        if (!cardIds) return json({ error: "card_ids must contain 1 to 500 unique UUIDs" }, 400);

        let query = admin
          .from("flashcards")
          .select("id, term, translation, list_id, lists!inner(owner_id)")
          .in("id", cardIds);
        if (listId) query = query.eq("list_id", listId);

        const { data: cards, error: cardsError } = await query;
        if (cardsError) throw cardsError;

        const ownedCards = (cards ?? []).filter(
          (card: Record<string, unknown>) => relationOwnerId(card.lists) === user.id,
        );
        if (ownedCards.length !== cardIds.length) {
          return json({ error: "Permission denied for one or more cards" }, 403);
        }

        let swapped = 0;
        for (const card of ownedCards) {
          const { error } = await admin
            .from("flashcards")
            .update({
              term: card.translation,
              translation: card.term,
              updated_at: new Date().toISOString(),
            })
            .eq("id", card.id);
          if (error) throw error;
          swapped += 1;
        }

        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_swap_cards",
          target: listId ?? "multiple",
          details: { card_count: swapped, card_ids: cardIds },
        });
        return json({ success: true, cards_swapped: swapped });
      }

      case "fix_metadata": {
        if (!listId) return json({ error: "list_id required" }, 400);
        const { data: list, error: readError } = await admin
          .from("lists")
          .select("lang_a, lang_b, labels_a, labels_b")
          .eq("id", listId)
          .single();
        if (readError) throw readError;

        const { error: updateError } = await admin
          .from("lists")
          .update({
            lang_a: list.lang_b,
            lang_b: list.lang_a,
            labels_a: list.labels_b,
            labels_b: list.labels_a,
            updated_at: new Date().toISOString(),
          })
          .eq("id", listId);
        if (updateError) throw updateError;

        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_fix_metadata",
          target: listId,
          details: { fields_changed: ["lang_a", "lang_b", "labels_a", "labels_b"] },
        });
        return json({ success: true, action: "metadata_swapped" });
      }

      case "full_repair": {
        if (!listId) return json({ error: "list_id required" }, 400);
        const { data, error } = await admin.rpc("swap_list_sides", { _list_id: listId });
        if (error) throw error;
        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_full_structural",
          target: listId,
          details: { completed: true },
        });
        return json({ success: true, ...(data ?? {}) });
      }

      case "mark_reviewed": {
        if (!listId) return json({ error: "list_id required" }, 400);
        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_mark_reviewed",
          target: listId,
          details: { status: "no_change_needed" },
        });
        return json({ success: true, action: "marked_reviewed" });
      }

      case "edit_card": {
        const cardId = body.card_id;
        const newTerm = body.new_term;
        const newTranslation = body.new_translation;
        if (!isUuid(cardId)) return json({ error: "Invalid card_id" }, 400);
        if (!isSafeOptionalText(newTerm) || !isSafeOptionalText(newTranslation)) {
          return json({ error: "Card text exceeds the allowed size" }, 400);
        }
        if (newTerm === undefined && newTranslation === undefined) {
          return json({ error: "No card fields supplied" }, 400);
        }

        const { data: card, error: cardError } = await admin
          .from("flashcards")
          .select("id, list_id, lists!inner(owner_id)")
          .eq("id", cardId)
          .maybeSingle();
        if (cardError) throw cardError;
        if (!card || relationOwnerId(card.lists) !== user.id) {
          return json({ error: "Permission denied" }, 403);
        }

        const updateFields: Record<string, unknown> = { updated_at: new Date().toISOString() };
        if (newTerm !== undefined) updateFields.term = newTerm;
        if (newTranslation !== undefined) updateFields.translation = newTranslation;

        const { error: editError } = await admin
          .from("flashcards")
          .update(updateFields)
          .eq("id", cardId);
        if (editError) throw editError;

        await admin.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_edit_card",
          target: cardId,
          details: {
            fields_changed: [
              ...(newTerm !== undefined ? ["term"] : []),
              ...(newTranslation !== undefined ? ["translation"] : []),
            ],
          },
        });
        return json({ success: true, action: "card_edited" });
      }
    }
  } catch (error) {
    console.error("repair-ab failed", error);
    return json({ error: "Internal server error" }, 500);
  }
});
