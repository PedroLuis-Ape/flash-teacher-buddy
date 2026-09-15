import { describe, expect, it } from "vitest";
import { resolveTitlePresentation } from "./scrollingTitleBehavior";

const BASE = {
  isMobile: true,
  mobileBehavior: "truncate" as const,
  mobileLines: 1 as const,
  overflows: true,
  prefersReducedMotion: false,
  isHovered: false,
  isVisible: true,
};

describe("ScrollingTitle — mobile legível, sem marquee automático", () => {
  it("mobile com overflow NÃO anima por padrão", () => {
    expect(resolveTitlePresentation(BASE).animate).toBe(false);
    expect(resolveTitlePresentation({ ...BASE, mobileBehavior: "wrap", mobileLines: 2 }).animate).toBe(false);
  });

  it("mobile só anima quando o consumidor pede marquee explicitamente", () => {
    expect(resolveTitlePresentation({ ...BASE, mobileBehavior: "marquee" }).animate).toBe(true);
  });

  it("wrap no mobile mostra até duas linhas iniciando no primeiro caractere", () => {
    const wrap = resolveTitlePresentation({ ...BASE, mobileBehavior: "wrap", mobileLines: 2 });
    expect(wrap.wrap).toBe(true);
    expect(wrap.lines).toBe(2);
    expect(wrap.animate).toBe(false);
  });

  it("desktop continua animando só em hover", () => {
    const desktop = { ...BASE, isMobile: false };
    expect(resolveTitlePresentation(desktop).animate).toBe(false);
    expect(resolveTitlePresentation({ ...desktop, isHovered: true }).animate).toBe(true);
    // wrap é política de mobile: desktop mantém a linha única.
    expect(resolveTitlePresentation({ ...desktop, mobileBehavior: "wrap" }).wrap).toBe(false);
  });

  it("reduced motion desliga animação e libera o texto completo em tooltip", () => {
    const reduced = resolveTitlePresentation({ ...BASE, mobileBehavior: "marquee", prefersReducedMotion: true });
    expect(reduced.animate).toBe(false);
    expect(reduced.showFullTextTooltip).toBe(true);
  });

  it("fora da viewport não anima mesmo com marquee explícito", () => {
    expect(resolveTitlePresentation({ ...BASE, mobileBehavior: "marquee", isVisible: false }).animate).toBe(false);
  });
});
