import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get user from auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if user is developer_admin
    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single();

    if (!roles || roles.role !== "developer_admin") {
      return new Response(JSON.stringify({ error: "Forbidden: Only developer_admin can import" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse CSV from request body
    const formData = await req.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return new Response(JSON.stringify({ error: "No file provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const csvText = await file.text();
    const lines = csvText.split("\n").map(l => l.trim()).filter(Boolean);

    if (lines.length < 2) {
      return new Response(JSON.stringify({ error: "CSV vazio ou inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse header
    const header = lines[0].split(",").map(h => h.trim());
    const requiredFields = ["kingdom_code", "level_code", "activity_type", "prompt", "answer"];
    
    for (const field of requiredFields) {
      if (!header.includes(field)) {
        return new Response(
          JSON.stringify({ error: `Campo obrigatório ausente: ${field}` }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Parse rows
    const activities = [];
    const errors = [];

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      const values = parseCSVLine(line);
      
      if (values.length !== header.length) {
        errors.push(`Linha ${i + 1}: número de colunas não corresponde ao cabeçalho`);
        continue;
      }

      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx];
      });

      try {
        const activity = parseActivity(row, i + 1);
        activities.push(activity);
      } catch (error) {
        errors.push((error as Error).message);
      }
    }

    if (errors.length > 0) {
      return new Response(
        JSON.stringify({ error: "Erros no CSV", details: errors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Insert/update activities
    const inserted = [];
    const updated = [];
    const failed = [];

    for (const activity of activities) {
      const { error } = await supabase
        .from("kingdom_activities")
        .upsert(
          {
            kingdom_code: activity.kingdom_code,
            level_code: activity.level_code,
            unit: activity.unit,
            activity_type: activity.activity_type,
            prompt: activity.prompt,
            hint: activity.hint,
            canonical_answer: activity.canonical_answer,
            alt_answers: activity.alt_answers,
            choices: activity.choices,
            lang: activity.lang,
            points: activity.points,
            tags: activity.tags,
          },
          {
            onConflict: "kingdom_code,level_code,activity_type,prompt",
            ignoreDuplicates: false,
          }
        );

      if (error) {
        failed.push({ activity: activity.prompt, error: error.message });
      } else {
        inserted.push(activity.prompt);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        inserted: inserted.length,
        failed: failed.length,
        failedDetails: failed,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Import error:", error);
    return new Response(
      JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function parseCSVLine(line: string): string[] {
  const values = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function extractHint(text: string): { text: string; hint: string | null } {
  const hintRegex = /\(([^)]+)\)/g;
  const matches = text.match(hintRegex);

  if (!matches) return { text, hint: null };

  const hint = matches.map(m => m.slice(1, -1)).join(" ");
  const cleanText = text.replace(hintRegex, "").trim().replace(/\s+/g, " ");

  return { text: cleanText, hint };
}

function extractAlternatives(text: string): { text: string; alternatives: string[] } {
  const altRegex = /\[([^\]]+)\]/g;
  const matches = text.match(altRegex);

  if (!matches) return { text, alternatives: [] };

  const alternatives: string[] = [];
  matches.forEach(match => {
    const content = match.slice(1, -1);
    const parts = content.split("|").map(p => p.trim()).filter(Boolean);
    alternatives.push(...parts);
  });

  const cleanText = text.replace(altRegex, "").trim().replace(/\s+/g, " ");

  return { text: cleanText, alternatives };
}

function parseChoices(choicesStr: string, answer: string): any[] {
  if (!choicesStr) return [];

  const parts = choicesStr.split("||").map(p => p.trim()).filter(Boolean);
  const choices: any[] = [];

  parts.forEach((part, idx) => {
    const isCorrect = part.startsWith("*");
    const text = isCorrect ? part.slice(1).trim() : part.trim();

    choices.push({
      id: `choice_${idx}`,
      text,
      is_correct: isCorrect || text === answer,
    });
  });

  return choices;
}

function parseActivity(row: Record<string, string>, lineNumber: number): any {
  const errors: string[] = [];

  if (!row.kingdom_code || !["K1", "K2", "K3"].includes(row.kingdom_code)) {
    errors.push(`Linha ${lineNumber}: kingdom_code inválido`);
  }

  if (!row.level_code) {
    errors.push(`Linha ${lineNumber}: level_code obrigatório`);
  }

  if (!row.activity_type) {
    errors.push(`Linha ${lineNumber}: activity_type obrigatório`);
  }

  const validTypes = ["translate", "multiple_choice", "dictation", "fill_blank", "order_words", "match"];
  if (row.activity_type && !validTypes.includes(row.activity_type)) {
    errors.push(`Linha ${lineNumber}: activity_type inválido`);
  }

  if (!row.prompt) {
    errors.push(`Linha ${lineNumber}: prompt obrigatório`);
  }

  if (!row.answer) {
    errors.push(`Linha ${lineNumber}: answer obrigatório`);
  }

  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }

  const { text: promptClean, hint: promptHint } = extractHint(row.prompt || "");
  const { text: answerClean, alternatives } = extractAlternatives(row.answer || "");
  const finalHint = promptHint || null;

  let choices = null;
  if (row.activity_type === "multiple_choice" && row.choices) {
    choices = parseChoices(row.choices, answerClean);
  }

  const tags = row.tags ? row.tags.split(";").map((t: string) => t.trim()).filter(Boolean) : [];

  return {
    kingdom_code: row.kingdom_code,
    level_code: row.level_code,
    unit: row.unit || "Outros",
    activity_type: row.activity_type,
    prompt: promptClean,
    hint: finalHint,
    canonical_answer: answerClean,
    alt_answers: alternatives.length > 0 ? alternatives : null,
    choices,
    lang: row.lang || "en-US",
    points: row.points ? parseInt(row.points) : null,
    tags: tags.length > 0 ? tags : null,
  };
}
