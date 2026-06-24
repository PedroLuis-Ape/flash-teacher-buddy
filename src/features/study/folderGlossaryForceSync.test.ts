import { readFileSync } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: mocks.from },
}));

import {
  inspectAndPublishFolderGlossaryRefresh,
  readFolderGlossaryRefreshReport,
} from "./lib/folderGlossaryRefresh";

function installBrowserStorage() {
  const values = new Map<string, string>();
  const dispatchEvent = vi.fn();
  vi.stubGlobal("window", {
    localStorage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
    dispatchEvent,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  });
  vi.stubGlobal("CustomEvent", class<T> {
    type: string;
    detail: T;
    constructor(type: string, init: { detail: T }) {
      this.type = type;
      this.detail = init.detail;
    }
  });
  return { dispatchEvent };
}

function installCountQueries() {
  mocks.from.mockImplementation((table: "lists" | "folder_glossary") => {
    let activeOnly = false;
    const builder: Record<string, unknown> = {};
    builder.select = vi.fn(() => builder);
    builder.eq = vi.fn((column: string) => {
      if (column === "is_active") activeOnly = true;
      return builder;
    });
    builder.is = vi.fn(() => builder);
    builder.then = (resolve: (value: unknown) => unknown) => resolve({
      count: table === "lists" ? 12 : activeOnly ? 2_900 : 2_950,
      error: null,
    });
    return builder;
  });
}

afterEach(() => {
  vi.unstubAllGlobals();
  mocks.from.mockReset();
});

describe("force folder glossary synchronization", () => {
  it("counts linked lists and glossary entries before broadcasting a refresh", async () => {
    const { dispatchEvent } = installBrowserStorage();
    installCountQueries();

    const report = await inspectAndPublishFolderGlossaryRefresh("folder-1");

    expect(report).toMatchObject({
      folderId: "folder-1",
      source: "manual",
      lists: 12,
      entries: 2_950,
      activeEntries: 2_900,
    });
    expect(readFolderGlossaryRefreshReport("folder-1")).toEqual(report);
    expect(dispatchEvent).toHaveBeenCalledTimes(1);
  });

  it("exposes the manual action and cross-view refresh listeners", () => {
    const card = readFileSync("src/features/study/components/FolderGlossaryForceSyncCard.tsx", "utf8");
    const manager = readFileSync("src/features/study/components/FolderGlossaryManager.tsx", "utf8");
    const folderHook = readFileSync("src/hooks/useFolderGlossary.ts", "utf8");
    const listHook = readFileSync("src/hooks/useListGlossary.ts", "utf8");

    expect(card).toContain("Sincronizar pasta inteira");
    expect(card).toContain("Não cria cópias nem multiplica registros");
    expect(manager).toContain("FolderGlossaryForceSyncCard");
    expect(folderHook).toContain("subscribeFolderGlossaryRefresh");
    expect(listHook).toContain("subscribeFolderGlossaryRefresh");
    expect(listHook).toContain('refetchOnMount: "always"');
  });
});
