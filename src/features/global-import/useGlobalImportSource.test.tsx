import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, describe, expect, it } from "vitest";
import { useGlobalImportSource } from "./useGlobalImportSource";

let source: ReturnType<typeof useGlobalImportSource>;
let renderer: ReactTestRenderer;
function Harness() { source = useGlobalImportSource(); return null; }
function mount() { act(() => { renderer = create(<Harness />); }); }
function deferredFile() {
  let resolve!: (text: string) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<string>((yes, no) => { resolve = yes; reject = no; });
  return { file: { name: "cards.txt", size: 20, text: () => promise } as File, resolve, reject };
}
afterEach(() => { if (renderer) act(() => renderer.unmount()); });

describe("import source behavior", () => {
  it("recognizes compatible plain text without writing to a backend", () => {
    mount();
    act(() => { source.analyze("Hello / Olá"); });
    expect(source.raw).toBe("Hello / Olá");
    expect(source.validation).not.toBeNull();
  });

  it("clears preview and notes when editing or cancelling the draft", () => {
    mount();
    act(() => { source.analyze("Hello / Olá"); });
    act(() => { source.reset(""); });
    expect(source.raw).toBe("");
    expect(source.validation).toBeNull();
    expect(source.notes).toEqual([]);
  });

  it("treats a dismissed file chooser as a no-op", async () => {
    mount();
    act(() => { source.reset("kept"); });
    await expect(source.readFile()).resolves.toBeNull();
    expect(source.raw).toBe("kept");
  });

  it("keeps the most recently selected file even when the older file finishes last", async () => {
    mount();
    const first = deferredFile();
    const second = deferredFile();
    let a!: ReturnType<typeof source.readFile>;
    let b!: ReturnType<typeof source.readFile>;
    act(() => { a = source.readFile(first.file); b = source.readFile(second.file); });
    await act(async () => { second.resolve("New / Novo"); await b; });
    await act(async () => { first.resolve("Old / Antigo"); expect(await a).toBeNull(); });
    expect(source.raw).toBe("New / Novo");
    expect(source.validation).not.toBeNull();
  });

  it.each(["Edited / Editado", ""]) ("does not overwrite an edit or cancelled draft %j", async (draft) => {
    mount();
    const pending = deferredFile();
    let result!: ReturnType<typeof source.readFile>;
    act(() => { result = source.readFile(pending.file); });
    act(() => { source.reset(draft); });
    await act(async () => { pending.resolve("Old / Antigo"); expect(await result).toBeNull(); });
    expect(source.raw).toBe(draft);
    expect(source.validation).toBeNull();
  });

  it("clears the previous preview while loading and keeps it invalid on failure", async () => {
    mount();
    act(() => { source.analyze("Hello / Olá"); });
    const pending = deferredFile();
    let result!: ReturnType<typeof source.readFile>;
    act(() => { result = source.readFile(pending.file); });
    expect(source.validation).toBeNull();
    await act(async () => {
      pending.reject(new Error("disk error"));
      await expect(result).rejects.toThrow("Não foi possível ler");
    });
    expect(source.validation).toBeNull();
  });

  it("ignores late results after closing and reopening the importer", async () => {
    mount();
    const pending = deferredFile();
    let result!: ReturnType<typeof source.readFile>;
    act(() => { result = source.readFile(pending.file); });
    act(() => { renderer.unmount(); });
    mount();
    await act(async () => { pending.resolve("Old / Antigo"); expect(await result).toBeNull(); });
    expect(source.raw).toBe("");
  });
});
