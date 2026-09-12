import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync(
  new URL("../../supabase/migrations/20260912233000_authorization_hardening_v1.sql", import.meta.url),
  "utf8",
);

const wrapped = [
  ["soft_delete_folder", "(uuid, uuid)"],
  ["soft_delete_list", "(uuid, uuid)"],
  ["restore_folder", "(uuid, uuid)"],
  ["restore_list", "(uuid, uuid)"],
  ["restore_flashcard", "(uuid, uuid)"],
  ["bulk_soft_delete_lists", "(uuid[], uuid)"],
  ["bulk_soft_delete_folders", "(uuid[], uuid)"],
  ["claim_gift_atomic", "(uuid, uuid)"],
  ["equip_skin_atomic", "(uuid, uuid, text, text)"],
  ["process_exchange", "(uuid, uuid, integer)"],
  ["process_skin_purchase", "(uuid, uuid, text, integer)"],
  ["swap_list_sides", "(uuid)"],
];

describe("endurecimento de autorizacao das RPCs (2026-09-12)", () => {
  it("deriva a identidade do JWT em vez de confiar no parametro do cliente", () => {
    expect(migration).toContain("public.security_actor_matches_v1");
    expect(migration).toContain("auth.uid() IS NOT NULL THEN p_claimed IS NOT NULL AND p_claimed = auth.uid()");
    expect(migration).toContain("auth.role() = 'service_role'");
  });

  it.each(wrapped)("preserva %s como versao interna e cria wrapper autorizado", (fn, args) => {
    expect(migration).toContain(`ALTER FUNCTION public.${fn}${args} RENAME TO ${fn}_unsafe_v1;`);
    expect(migration).toContain(
      `REVOKE ALL ON FUNCTION public.${fn}_unsafe_v1${args} FROM PUBLIC, anon, authenticated;`,
    );
    expect(migration).toContain(`GRANT EXECUTE ON FUNCTION public.${fn}${args} TO authenticated, service_role;`);
  });

  it("fecha o bypass de auth.uid() nulo em perfil e inversao de lados", () => {
    const perfil = migration.slice(migration.indexOf("FUNCTION public.update_own_profile("));
    expect(perfil).toContain("IF auth.uid() IS NULL THEN");
    const swap = migration.slice(migration.indexOf("FUNCTION public.swap_list_sides(_list_id uuid)"));
    expect(swap).toContain("IF auth.uid() IS NULL THEN");
  });

  it("usa o preco do catalogo na compra em vez do valor enviado pelo cliente", () => {
    expect(migration).toContain("SELECT price_pitecoin INTO v_catalog_price");
    expect(migration).toContain("FROM public.skins_catalog");
    expect(migration).toContain("IF p_price IS DISTINCT FROM v_catalog_price THEN");
    expect(migration).toContain("PRICE_MISMATCH");
  });

  it("retira rotinas internas da superficie da API", () => {
    expect(migration).toContain(
      "REVOKE ALL ON FUNCTION public.purge_expired_trash() FROM PUBLIC, anon, authenticated;",
    );
    expect(migration).toContain("GRANT EXECUTE ON FUNCTION public.purge_expired_trash() TO service_role;");
  });
});

