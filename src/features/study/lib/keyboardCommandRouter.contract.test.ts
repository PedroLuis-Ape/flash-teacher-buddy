import { afterEach, describe, expect, it, vi } from "vitest";
import {
  clearShortcutScope,
  getActiveShortcutScope,
  hasOpenModal,
  isShortcutScopeBlocking,
  resetShortcutScopes,
  setShortcutScope,
  shouldBlockSessionShortcut,
} from "./keyboardCommandRouter";

function keyEvent(key: string, target: unknown = { tagName: "DIV", isContentEditable: false }): KeyboardEvent {
  return { key, target } as unknown as KeyboardEvent;
}

const TEXTAREA = { tagName: "TEXTAREA", isContentEditable: false };

afterEach(() => {
  resetShortcutScopes();
  vi.unstubAllGlobals();
});

describe("Keyboard command router — dono único do teclado", () => {
  it("sem donos registrados nada é bloqueado", () => {
    expect(getActiveShortcutScope()).toBe("session");
    expect(isShortcutScopeBlocking()).toBe(false);
    expect(shouldBlockSessionShortcut(keyEvent("Q"))).toBe(false);
  });

  it("campo de texto bloqueia digitação comum e libera só o que o modo permitir", () => {
    expect(shouldBlockSessionShortcut(keyEvent("Q", TEXTAREA))).toBe(true);
    expect(shouldBlockSessionShortcut(keyEvent("w", TEXTAREA))).toBe(true);
    expect(shouldBlockSessionShortcut(keyEvent(" ", TEXTAREA))).toBe(true);
    expect(shouldBlockSessionShortcut(keyEvent("Enter", TEXTAREA))).toBe(true);
    // Exceção explícita do modo que confirma resposta com Enter.
    expect(shouldBlockSessionShortcut(keyEvent("Enter", TEXTAREA), { allowEnter: true })).toBe(false);
  });

  it("escopo text-entry bloqueia atalhos mesmo fora do campo (estado explícito)", () => {
    setShortcutScope("write-answer", "text-entry");
    expect(getActiveShortcutScope()).toBe("text-entry");
    for (const key of ["Q", "A", "W", "D", "R", "F", "E", "S", " "]) {
      expect(shouldBlockSessionShortcut(keyEvent(key)), key).toBe(true);
    }
  });

  it("preset gamer no Write: digitar não navega, e o feedback devolve os atalhos", () => {
    setShortcutScope("write-answer", "text-entry");
    expect(shouldBlockSessionShortcut(keyEvent("D"))).toBe(true); // próximo card
    expect(shouldBlockSessionShortcut(keyEvent("A"))).toBe(true); // card anterior
    expect(shouldBlockSessionShortcut(keyEvent("W"))).toBe(true); // virar
    expect(shouldBlockSessionShortcut(keyEvent("R"))).toBe(true); // reiniciar

    setShortcutScope("write-answer", "feedback");
    expect(getActiveShortcutScope()).toBe("feedback");
    expect(shouldBlockSessionShortcut(keyEvent("D"))).toBe(false);
    expect(isShortcutScopeBlocking()).toBe(false);
  });

  it("vale o dono mais restrito e o escopo volta ao sair", () => {
    setShortcutScope("study", "session");
    setShortcutScope("write-answer", "feedback");
    expect(getActiveShortcutScope()).toBe("feedback");
    setShortcutScope("dialog", "modal");
    expect(getActiveShortcutScope()).toBe("modal");
    clearShortcutScope("dialog");
    expect(getActiveShortcutScope()).toBe("feedback");
    clearShortcutScope("write-answer");
    expect(getActiveShortcutScope()).toBe("session");
  });

  it("modal aberto bloqueia comando de sessão mesmo sem escopo registrado", () => {
    vi.stubGlobal("document", { querySelector: () => ({}) });
    expect(hasOpenModal()).toBe(true);
    expect(shouldBlockSessionShortcut(keyEvent("D"))).toBe(true);
    // Handlers que pertencem ao próprio modal podem ignorar essa checagem.
    expect(shouldBlockSessionShortcut(keyEvent("Escape"), { ignoreModal: true })).toBe(false);
  });

  it("sem modal aberto o documento não bloqueia nada", () => {
    vi.stubGlobal("document", { querySelector: () => null });
    expect(hasOpenModal()).toBe(false);
    expect(shouldBlockSessionShortcut(keyEvent("D"))).toBe(false);
  });
});
