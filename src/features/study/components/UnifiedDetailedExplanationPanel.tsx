import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Info, LockKeyhole, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import { subscribeDetailedExplanationPanelToggle } from "@/features/study/lib/currentDetailedExplanation";
import "./desktop-explanation.css";

interface UnifiedDetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

const DESKTOP_QUERY = "(min-width: 1280px)";

function cleanText(value: unknown): string {
  return String(value ?? "").trim();
}

function storageKey(pathname: string, userId?: string): string {
  return `ape:detailed-explanation-panel:${userId || "anon"}:${pathname}`;
}

function readEnabled(key: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return window.localStorage.getItem(key) === "always";
  } catch {
    return false;
  }
}

function saveEnabled(key: string, enabled: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (enabled) window.localStorage.setItem(key, "always");
    else window.localStorage.setItem(key, "off");
  } catch {
    // Persistência é melhoria opcional; nunca deve quebrar o estudo.
  }
}

function inspectAnswerRevealed(root: HTMLElement, search: string): boolean {
  const mode = new URLSearchParams(search).get("mode");
  if (mode === "pronunciation") return true;

  const flipInner = root.querySelector<HTMLElement>(".flip-card-inner");
  if (flipInner) return flipInner.classList.contains("flipped");

  const labels = Array.from(root.querySelectorAll("button"))
    .map((button) => button.textContent?.trim().replace(/\s+/g, " ") ?? "");
  if (labels.includes("Sabia") && labels.includes("Não Sabia")) return true;

  return Boolean(root.querySelector('[role="status"]'));
}

function Section({
  title,
  icon,
  children,
  warning = false,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  warning?: boolean;
}) {
  return (
    <section className={warning ? "rounded-xl border border-amber-500/25 bg-amber-500/5 p-3" : "rounded-xl border border-border/70 bg-muted/20 p-3"}>
      <div className="mb-2 flex items-center gap-2">
        <span className={warning ? "text-amber-500" : "text-primary"}>{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function UnifiedDetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: UnifiedDetailedExplanationPanelProps) {
  const location = useLocation();
  const { userId } = useAuthUser();
  const markerRef = useRef<HTMLSpanElement>(null);
  const layoutRef = useRef<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [isDesktop, setIsDesktop] = useState(() => typeof window !== "undefined" && window.matchMedia(DESKTOP_QUERY).matches);
  const key = useMemo(() => storageKey(location.pathname, userId), [location.pathname, userId]);
  const [enabled, setEnabled] = useState(() => readEnabled(key));
  const [answerRevealed, setAnswerRevealed] = useState(false);

  const hasContent = Boolean(cleanText(explanation) || cleanText(usageNotes) || cleanText(commonMistakes));
  const isOpen = isDesktop && enabled && hasContent;

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_QUERY);
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    setEnabled(readEnabled(key));
  }, [key]);

  useLayoutEffect(() => {
    if (!isDesktop) return;
    const layout = markerRef.current?.previousElementSibling as HTMLElement | null;
    if (!layout) return;

    layoutRef.current = layout;
    layout.classList.add("study-explanation-layout");

    const host = document.createElement("div");
    host.className = "study-explanation-panel-host";
    host.setAttribute("data-study-explanation-panel-host", "true");
    layout.appendChild(host);
    setPanelHost(host);

    return () => {
      layout.classList.remove("study-explanation-layout");
      host.remove();
      layoutRef.current = null;
      setPanelHost(null);
    };
  }, [isDesktop]);

  useEffect(() => {
    if (!isDesktop) return;
    const root = layoutRef.current?.querySelector<HTMLElement>(".max-w-2xl");
    if (!root) return;

    let frame = 0;
    const refresh = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        setAnswerRevealed(inspectAnswerRevealed(root, location.search));
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "aria-expanded", "role"],
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [isDesktop, location.search, explanation, usageNotes, commonMistakes]);

  const setPersistentEnabled = (next: boolean) => {
    setEnabled(next);
    saveEnabled(key, next);
  };

  useEffect(() => {
    if (!isDesktop) return;
    return subscribeDetailedExplanationPanelToggle(() => {
      if (!hasContent) return;
      setPersistentEnabled(!enabled);
    });
  }, [enabled, hasContent, isDesktop, key]);

  useEffect(() => {
    if (!isDesktop) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;
      if (event.altKey && event.key.toLocaleLowerCase() === "e" && hasContent) {
        event.preventDefault();
        setPersistentEnabled(!enabled);
      }
      if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        setPersistentEnabled(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [enabled, hasContent, isDesktop, isOpen, key]);

  const panel = isOpen ? (
    <aside className="study-explanation-panel" aria-label="Dica e explicação do card">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Dica e explicação</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Persistente no desktop até você fechar</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => setPersistentEnabled(false)}
          aria-label="Fechar dica e explicação"
          title="Fechar e desativar painel persistente"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="max-h-[76vh] space-y-3 overflow-y-auto overscroll-contain p-4">
        {!answerRevealed ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-8 text-center">
            <LockKeyhole className="mb-3 h-7 w-7 text-primary" />
            <p className="text-sm font-semibold">Responda primeiro</p>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
              Revele ou confira a resposta para liberar a explicação deste card.
            </p>
          </div>
        ) : (
          <>
            {cleanText(explanation) && (
              <Section icon={<BookOpen className="h-4 w-4" />} title="Explicação detalhada">
                {explanation}
              </Section>
            )}
            {cleanText(usageNotes) && (
              <Section icon={<Info className="h-4 w-4" />} title="Como usar">
                {usageNotes}
              </Section>
            )}
            {cleanText(commonMistakes) && (
              <Section icon={<AlertTriangle className="h-4 w-4" />} title="Erros comuns" warning>
                {commonMistakes}
              </Section>
            )}
          </>
        )}
      </div>
    </aside>
  ) : null;

  return (
    <>
      <span ref={markerRef} className="hidden" aria-hidden="true" />
      {panelHost && panel ? createPortal(panel, panelHost) : null}
    </>
  );
}
