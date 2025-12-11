import { useRef, useState, useEffect } from "react";
import { cn } from "@/lib/utils";

interface ScrollingTitleProps {
  text: string;
  className?: string;
}

/**
 * Componente que exibe texto com animação de scroll horizontal
 * quando o conteúdo é maior que o container
 */
export function ScrollingTitle({ text, className }: ScrollingTitleProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);

  useEffect(() => {
    const checkOverflow = () => {
      if (containerRef.current && textRef.current) {
        const containerWidth = containerRef.current.offsetWidth;
        const textWidth = textRef.current.scrollWidth;
        setShouldScroll(textWidth > containerWidth);
      }
    };

    checkOverflow();
    
    // Re-check on resize
    const resizeObserver = new ResizeObserver(checkOverflow);
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    return () => resizeObserver.disconnect();
  }, [text]);

  return (
    <div
      ref={containerRef}
      className={cn(
        "overflow-hidden whitespace-nowrap",
        className
      )}
    >
      <span
        ref={textRef}
        className={cn(
          "inline-block",
          shouldScroll && "animate-marquee hover:animation-paused"
        )}
        style={shouldScroll ? {
          animation: "marquee 8s linear infinite",
          paddingRight: "2rem",
        } : undefined}
      >
        {text}
        {/* Texto duplicado para efeito de loop contínuo */}
        {shouldScroll && (
          <span className="pl-8" aria-hidden="true">
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
