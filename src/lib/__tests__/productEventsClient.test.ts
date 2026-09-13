import { beforeEach, describe, expect, it, vi } from "vitest";

const { rpc } = vi.hoisted(() => ({ rpc: vi.fn() }));

vi.mock("@/integrations/supabase/publicClient", () => ({ publicSupabase: { rpc } }));

import {
  productEventsEnabled,
  resetProductEventOnceForTests,
  sanitizeProductPayload,
  trackProductEvent,
  trackProductEventOnce,
} from "@/lib/productEvents";

const setHostname = (hostname: string | null) => {
  if (hostname === null) {
    delete (globalThis as { window?: unknown }).window;
    return;
  }
  (globalThis as { window?: unknown }).window = { location: { hostname } };
};

describe("trackProductEvent", () => {
  beforeEach(() => {
    rpc.mockReset();
    resetProductEventOnceForTests();
    setHostname("www.apeeducation.org");
  });

  it("nao envia em desenvolvimento nem sem window", async () => {
    setHostname("localhost");
    expect(productEventsEnabled()).toBe(false);
    await expect(trackProductEvent("guest_resume", { mode: "mixed" })).resolves.toBe(false);
    expect(rpc).not.toHaveBeenCalled();

    setHostname(null);
    expect(productEventsEnabled()).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("nao rotula locale quando a superficie nao informa", async () => {
    rpc.mockResolvedValue({ error: null });
    await trackProductEvent("guest_resume", { mode: "mixed" });
    expect(rpc).toHaveBeenCalledWith("record_product_event_v1", {
      _name: "guest_resume",
      _payload: { mode: "mixed" },
      _locale: null,
      _surface: null,
    });
  });

  it("mantem apenas as chaves da allowlist do evento", () => {
    const safe = sanitizeProductPayload("public_search_used", {
      result_count: 3,
      has_filters: true,
      termo_digitado: "segredo",
      email: "a@b.c",
    });
    expect(safe).toEqual({ result_count: 3, has_filters: true });
  });

  it("devolve null para evento desconhecido", () => {
    expect(sanitizeProductPayload("evento_inventado", { a: 1 })).toBeNull();
  });

  it("nao chama a RPC quando o evento nao esta na allowlist", async () => {
    const result = await trackProductEvent("evento_inventado", {});
    expect(result).toBe(false);
    expect(rpc).not.toHaveBeenCalled();
  });

  it("envia o payload saneado e devolve true no sucesso", async () => {
    rpc.mockResolvedValue({ error: null });
    const result = await trackProductEvent(
      "public_resource_view",
      { resource_slug: "exemplo-a1", ignorado: "x" },
      { locale: "pt-BR", surface: "material" },
    );
    expect(result).toBe(true);
    expect(rpc).toHaveBeenCalledWith("record_product_event_v1", {
      _name: "public_resource_view",
      _payload: { resource_slug: "exemplo-a1" },
      _locale: "pt-BR",
      _surface: "material",
    });
  });

  it("devolve false quando a RPC responde erro", async () => {
    rpc.mockResolvedValue({ error: { message: "PGRST202" } });
    const result = await trackProductEvent("guest_resume", { mode: "mixed" });
    expect(result).toBe(false);
  });

  it("nunca lanca quando a rede falha", async () => {
    rpc.mockRejectedValue(new Error("offline"));
    await expect(trackProductEvent("guest_resume", { mode: "mixed" })).resolves.toBe(false);
  });

  it("emite uma unica vez por chave de pagina", async () => {
    rpc.mockResolvedValue({ error: null });
    await trackProductEventOnce("home:impression", "featured_resource_impression", { position: 1 });
    await trackProductEventOnce("home:impression", "featured_resource_impression", { position: 1 });
    expect(rpc).toHaveBeenCalledTimes(1);
  });
});
