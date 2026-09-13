import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const sql = readFileSync(
  resolve(process.cwd(), "supabase/migrations/20260913200000_product_events_v1.sql"),
  "utf8",
);

const normalized = sql.toLowerCase();

const EVENT_NAMES = [
  "featured_resource_impression",
  "featured_resource_play",
  "public_resource_view",
  "public_search_used",
  "guest_game_start",
  "guest_game_complete",
  "guest_resume",
  "signup_sync_cta_view",
  "signup_after_guest",
  "carousel_slide_view",
  "carousel_interaction",
];

describe("contrato de eventos first-party (Fase 5)", () => {
  it("cria a tabela insert-only com RLS deny-all", () => {
    expect(normalized).toContain("create table if not exists public.product_event");
    expect(normalized).toContain("alter table public.product_event enable row level security");
    expect(normalized).toContain("revoke all on table public.product_event from public, anon, authenticated");
  });

  it("mantem a allowlist fechada dos onze eventos", () => {
    for (const name of EVENT_NAMES) {
      expect(sql).toContain(name);
    }
    expect(normalized).toContain("unknown_event");
  });

  it("descarta chave fora da allowlist e payload grande demais", () => {
    expect(normalized).toContain("jsonb_each");
    expect(normalized).toContain("where key = any(v_allowed_keys)");
    expect(normalized).toContain("payload_too_large");
    expect(normalized).toContain("octet_length");
  });

  it("protege contra flood com throttle por janela", () => {
    expect(normalized).toContain("throttled");
    expect(normalized).toContain("interval '1 minute'");
  });

  it("expoe a rpc com search_path fixo e grant minimo", () => {
    expect(normalized).toContain("create or replace function public.record_product_event_v1");
    expect(normalized).toContain("security definer");
    expect(normalized).toContain("set search_path = public");
    expect(normalized).toContain("revoke all on function public.record_product_event_v1(text, jsonb, text, text) from public");
    expect(normalized).toContain(
      "grant execute on function public.record_product_event_v1(text, jsonb, text, text) to anon, authenticated, service_role",
    );
  });

  it("nao grava identificador pessoal nem usuario", () => {
    for (const forbidden of ["user_id", "email", "device_id", "ip_address", "answer"]) {
      expect(normalized).not.toContain(forbidden);
    }
  });

  it("documenta o rollback no proprio arquivo", () => {
    expect(normalized).toContain("rollback");
    expect(normalized).toContain("drop function if exists public.record_product_event_v1");
    expect(normalized).toContain("drop table if exists public.product_event");
  });
});

