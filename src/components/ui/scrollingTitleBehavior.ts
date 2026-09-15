/**
 * Semântica de apresentação do ScrollingTitle — pura e testável.
 *
 * Regra do produto (mobile): informação de navegação precisa estar LEGÍVEL
 * PARADA. Marquee automático ao entrar na viewport é proibido no mobile: era a
 * causa de títulos aparecerem começando no meio da palavra (“…içado”).
 */
export type MobileTitleBehavior = "wrap" | "truncate" | "marquee";
export type MobileTitleLines = 1 | 2;

export interface TitlePresentationInput {
  isMobile: boolean;
  mobileBehavior: MobileTitleBehavior;
  mobileLines: MobileTitleLines;
  overflows: boolean;
  prefersReducedMotion: boolean;
  isHovered: boolean;
  isVisible: boolean;
}

export interface TitlePresentation {
  /** Marquee ligado? No mobile só quando o consumidor pede explicitamente. */
  animate: boolean;
  /** O container quebra linha (wrap) em vez de manter uma linha só. */
  wrap: boolean;
  /** Quantas linhas mostrar quando `wrap` está ativo. */
  lines: MobileTitleLines;
  /** Mostrar tooltip com o texto completo (overflow + reduced motion). */
  showFullTextTooltip: boolean;
}

export function resolveTitlePresentation({
  isMobile,
  mobileBehavior,
  mobileLines,
  overflows,
  prefersReducedMotion,
  isHovered,
  isVisible,
}: TitlePresentationInput): TitlePresentation {
  const wrap = isMobile && mobileBehavior === "wrap";

  const mobileMayAnimate = isMobile && mobileBehavior === "marquee";
  const desktopMayAnimate = !isMobile && isHovered;
  const animate = overflows
    && !prefersReducedMotion
    && isVisible
    && (mobileMayAnimate || desktopMayAnimate);

  return {
    animate,
    wrap,
    lines: wrap ? mobileLines : 1,
    showFullTextTooltip: overflows && prefersReducedMotion,
  };
}
