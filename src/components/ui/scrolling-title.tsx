import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPerfSettings } from "@/lib/performanceSettings";
import {
  resolveTitlePresentation,
  type MobileTitleBehavior,
  type MobileTitleLines,
} from "./scrollingTitleBehavior";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScrollingTitleProps {
  text: string;
  className?: string;
  /**
   * Mobile: `wrap`/`truncate` mantêm o texto parado e legível (default).
   * `marquee` só existe para quem pedir explicitamente — nunca é automático.
   */
  mobileBehavior?: MobileTitleBehavior;
  /** Linhas visíveis quando `mobileBehavior="wrap"`. */
  mobileLines?: MobileTitleLines;
}

/**
 * Componente que exibe texto com animação de scroll horizontal (marquee)
 * quando o conteúdo é maior que o container.
 *
 * - Mobile: texto PARADO por padrão (`wrap` com 1–2 linhas ou `truncate`).
 *   Marquee no mobile só sob pedido explícito (`mobileBehavior="marquee"`).
 * - Desktop: scroll somente em hover/focus.
 * - Respeita prefers-reduced-motion: sem animação, mostra tooltip.
 */
export function ScrollingTitle({
  text,
  className,
  mobileBehavior = "truncate",
  mobileLines = 1,
}: ScrollingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  // Check prefers-reduced-motion OR perf settings
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(() => {
    return getPerfSettings().reduceMotion;
  });
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const perfReduced = getPerfSettings().reduceMotion;
    setPrefersReducedMotion(mql.matches || perfReduced);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches || getPerfSettings().reduceMotion);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  // Measure overflow
  useEffect(() => {
    const check = () => {
      if (containerRef.current && textRef.current) {
        setOverflows(textRef.current.scrollWidth > containerRef.current.offsetWidth);
      }
    };
    check();
    const ro = new ResizeObserver(check);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [text]);

  // IntersectionObserver — only animate when on screen
  useEffect(() => {
    if (!containerRef.current) return;
    const io = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.3 }
    );
    io.observe(containerRef.current);
    return () => io.disconnect();
  }, []);

  // Semântica pura e testada (mobile nunca anima sem opt-in explícito).
  const presentation = resolveTitlePresentation({
    isMobile,
    mobileBehavior,
    mobileLines,
    overflows,
    prefersReducedMotion,
    isHovered,
    isVisible,
  });
  const shouldAnimate = presentation.animate;

  // For reduced-motion users who have overflow, wrap in tooltip
  const content = (
    <div
      ref={containerRef}
      data-mobile-behavior={mobileBehavior}
      data-wrap={presentation.wrap ? "true" : "false"}
      className={cn(
        "overflow-hidden",
        presentation.wrap ? "whitespace-normal" : "whitespace-nowrap",
        presentation.wrap && (presentation.lines === 2 ? "line-clamp-2" : "line-clamp-1"),
        className,
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onFocus={() => setIsHovered(true)}
      onBlur={() => setIsHovered(false)}
      tabIndex={overflows ? 0 : undefined}
      role={overflows ? "marquee" : undefined}
      aria-label={text}
      title={prefersReducedMotion && overflows ? text : undefined}
    >
      <span
        ref={textRef}
        className={cn(
          "inline-block",
          presentation.wrap && "w-full break-words align-top",
          !shouldAnimate && !presentation.wrap && "truncate max-w-full",
        )}
        style={
          shouldAnimate
            ? {
                animation: "marquee-pause 10s linear infinite",
                paddingRight: "2rem",
              }
            : undefined
        }
      >
        {text}
        {shouldAnimate && (
          <span className="pl-8" aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </div>
  );

  // Wrap in tooltip for reduced-motion users
  if (presentation.showFullTextTooltip) {
    return (
      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>{content}</TooltipTrigger>
          <TooltipContent side="top" className="max-w-xs break-words">
            {text}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return content;
}
