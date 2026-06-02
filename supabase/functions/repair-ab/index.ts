import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action, list_id, card_ids } = body;

    // Verify ownership
    if (list_id) {
      const { data: list } = await supabase
        .from("lists")
        .select("owner_id")
        .eq("id", list_id)
        .single();

      if (!list || list.owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Permission denied" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    let result: any = { success: false };

    switch (action) {
      // ─── Swap specific cards' term ↔ translation ───────────────
      case "swap_cards": {
        if (!card_ids || !Array.isArray(card_ids) || card_ids.length === 0) {
          return new Response(
            JSON.stringify({ error: "card_ids required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // SECURITY: only operate on cards belonging to lists owned by the caller.
        const { data: beforeCards } = await supabase
          .from("flashcards")
          .select("id, term, translation, list_id, lists!inner(owner_id)")
          .in("id", card_ids);

        const ownedCards = (beforeCards || []).filter(
          (c: any) => c.lists?.owner_id === user.id
        );

        if (ownedCards.length !== card_ids.length) {
          return new Response(
            JSON.stringify({ error: "Permission denied: one or more cards do not belong to you" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Swap term ↔ translation for specified cards
        // We need to do this per-card since Supabase doesn't support swapping columns in bulk
        let swapped = 0;
        for (const card of ownedCards) {
          const { error } = await supabase
            .from("flashcards")
            .update({
              term: card.translation,
              translation: card.term,
              updated_at: new Date().toISOString(),
            })
            .eq("id", card.id);

          if (!error) swapped++;
        }

        // Log the repair
        await supabase.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_swap_cards",
          target: list_id || "multiple",
          details: {
            card_ids,
            cards_swapped: swapped,
            before_samples: ownedCards.slice(0, 5).map((c: any) => ({
              id: c.id,
              term_was: c.term?.substring(0, 50),
              translation_was: c.translation?.substring(0, 50),
            })),
          },
        });

        result = { success: true, cards_swapped: swapped };
        break;
      }

      // ─── Fix list metadata only (swap lang/labels) ─────────────
      case "fix_metadata": {
        if (!list_id) {
          return new Response(
            JSON.stringify({ error: "list_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { data: list } = await supabase
          .from("lists")
          .select("lang_a, lang_b, labels_a, labels_b")
          .eq("id", list_id)
          .single();

        if (!list) {
          return new Response(
            JSON.stringify({ error: "List not found" }),
            { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const { error: updateError } = await supabase
          .from("lists")
          .update({
            lang_a: list.lang_b,
            lang_b: list.lang_a,
            labels_a: list.labels_b,
            labels_b: list.labels_a,
            updated_at: new Date().toISOString(),
          })
          .eq("id", list_id);

        if (updateError) throw updateError;

        await supabase.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_fix_metadata",
          target: list_id,
          details: {
            before: { lang_a: list.lang_a, lang_b: list.lang_b, labels_a: list.labels_a, labels_b: list.labels_b },
            after: { lang_a: list.lang_b, lang_b: list.lang_a, labels_a: list.labels_b, labels_b: list.labels_a },
          },
        });

        result = { success: true, action: "metadata_swapped" };
        break;
      }

      // ─── Full structural repair: swap metadata + all cards ─────
      case "full_repair": {
        if (!list_id) {
          return new Response(
            JSON.stringify({ error: "list_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // Use the existing swap_list_sides RPC
        const { data: rpcResult, error: rpcError } = await supabase.rpc(
          "swap_list_sides",
          { _list_id: list_id }
        );

        if (rpcError) throw rpcError;

        await supabase.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_full_structural",
          target: list_id,
          details: rpcResult,
        });

        result = { success: true, ...rpcResult };
        break;
      }

      // ─── Mark as reviewed (no changes) ─────────────────────────
      case "mark_reviewed": {
        if (!list_id) {
          return new Response(
            JSON.stringify({ error: "list_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        await supabase.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_mark_reviewed",
          target: list_id,
          details: { status: "no_change_needed" },
        });

        result = { success: true, action: "marked_reviewed" };
        break;
      }

      // ─── Edit a single card manually ───────────────────────────
      case "edit_card": {
        const { card_id, new_term, new_translation } = body;
        if (!card_id) {
          return new Response(
            JSON.stringify({ error: "card_id required" }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        // SECURITY: verify card belongs to a list owned by the caller before editing.
        const { data: before } = await supabase
          .from("flashcards")
          .select("term, translation, list_id, lists!inner(owner_id)")
          .eq("id", card_id)
          .single();

        if (!before || (before as any).lists?.owner_id !== user.id) {
          return new Response(
            JSON.stringify({ error: "Permission denied" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        const updateFields: any = { updated_at: new Date().toISOString() };
        if (new_term !== undefined) updateFields.term = new_term;
        if (new_translation !== undefined) updateFields.translation = new_translation;

        const { error: editError } = await supabase
          .from("flashcards")
          .update(updateFields)
          .eq("id", card_id);

        if (editError) throw editError;

        await supabase.from("admin_logs").insert({
          actor_id: user.id,
          action: "repair_edit_card",
          target: card_id,
          details: {
            before: { term: (before as any).term, translation: (before as any).translation },
            after: { term: new_term, translation: new_translation },
          },
        });

        result = { success: true, action: "card_edited" };
        break;
      }

      default:
        return new Response(
          JSON.stringify({ error: `Unknown action: ${action}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message || "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
