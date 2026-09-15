import { describe, expect, it } from "vitest";
import { evaluateTypeToAnswerKey, isPrintableTextKey } from "./typeToAnswer";

const options = {
  enabled: true,
  activeElement: null,
  overlayOpen: false,
  scopeBlocking: false,
};

describe("typeToAnswer", () => {
  it("captures the first printable character", () => {
    expect(evaluateTypeToAnswerKey({ key: "a" }, options)).toEqual({ capture: true });
    expect(evaluateTypeToAnswerKey({ key: "Á" }, options)).toEqual({ capture: true });
  });

  it("does not capture modifier combinations", () => {
    expect(evaluateTypeToAnswerKey({ key: "a", ctrlKey: true }, options).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "a", metaKey: true }, options).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "a", altKey: true }, options).capture).toBe(false);
  });

  it("does not capture IME composition", () => {
    expect(evaluateTypeToAnswerKey({ key: "あ", isComposing: true }, options).capture).toBe(false);
  });

  it("does not capture semantic/special keys", () => {
    for (const key of ["Enter", "Tab", "Escape", "ArrowLeft", "ArrowRight", "Backspace", "F1", " "]) {
      expect(isPrintableTextKey({ key })).toBe(false);
      expect(evaluateTypeToAnswerKey({ key }, options).capture).toBe(false);
    }
  });

  it("does not steal input from an already focused editable", () => {
    const editable = { tagName: "INPUT", isContentEditable: false } as unknown as EventTarget;
    expect(evaluateTypeToAnswerKey({ key: "x", target: editable }, options).capture).toBe(false);
  });

  it("does not capture while an overlay or blocking scope is active", () => {
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, overlayOpen: true }).capture).toBe(false);
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, scopeBlocking: true }).capture).toBe(false);
  });

  it("does nothing when the text-answer state is disabled", () => {
    expect(evaluateTypeToAnswerKey({ key: "x" }, { ...options, enabled: false }).capture).toBe(false);
  });
});
