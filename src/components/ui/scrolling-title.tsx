import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { getPerfSettings } from "@/lib/performanceSettings";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ScrollingTitleProps {
  text: string;
  className?: string;
}

/**
 * Componente que exibe texto com animação de scroll horizontal (marquee)
 * quando o conteúdo é maior que o container.
 *
 * - Mobile: auto-scroll quando visível na viewport (IntersectionObserver).
 * - Desktop: scroll somente em hover/focus.
 * - Respeita prefers-reduced-motion: sem animação, mostra tooltip.
 */
export function ScrollingTitle({ text, className }: ScrollingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const isMobile = useIsMobile();

  // Check prefers-reduced-motion
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  useEffect(() => {
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mql.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
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

  // Determine if animation should play
  const shouldAnimate =
    overflows &&
    !prefersReducedMotion &&
    isVisible &&
    (isMobile || isHovered);

  // For reduced-motion users who have overflow, wrap in tooltip
  const content = (
    <div
      ref={containerRef}
      className={cn("overflow-hidden whitespace-nowrap", className)}
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
          !shouldAnimate && "truncate max-w-full"
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
  if (prefersReducedMotion && overflows) {
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
