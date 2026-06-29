import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Info, LockKeyhole, Tags, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuthUser } from "@/hooks/useAuthUser";
import {
  explanationCardKey,
  explanationStorageKey,
  loadRemoteExplanationPreference,
  readLocalExplanationPreference,
  resolveExplanationScope,
  saveLocalExplanationPreference,
  saveRemoteExplanationCard,
  saveRemoteExplanationMode,
  type ExplanationDisplayMode,
} from "@/features/study/lib/studyExplanationPersistence";
import "./desktop-explanation.css";

interface DesktopDetailedExplanationPanelProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

function normalizeText(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function extractPrompt(root: HTMLElement): string {
  const selectors = [
    ".flip-card-front p.text-xl",
    ".flip-card-front p.text-3xl",
    "[data-study-question]",
    "h2",
    "p.font-bold",
    "p.font-semibold",
  ];

  for (const selector of selectors) {
    const text = normalizeText(root.querySelector<HTMLElement>(selector)?.textContent);
    if (text.length > 1) return text.slice(0, 500);
  }

  return normalizeText(root.textContent).slice(0, 500);
}

function extractImportantTerms(root: HTMLElement): string[] {
  const terms = new Map<string, string>();
  root.querySelectorAll<HTMLButtonElement>('button[aria-label*=": abrir "]').forEach((button) => {
    const value = (button.getAttribute("aria-label") || "").split(": abrir ")[0]?.trim();
    const key = value?.toLocaleLowerCase();
    if (value && key && !terms.has(key)) terms.set(key, value);
  });
  return Array.from(terms.values()).slice(0, 12);
}

function inspectAnswerState(root: HTMLElement, search: string) {
  const pronunciation = new URLSearchParams(search).get("mode") === "pronunciation";
  if (pronunciation) return { revealed: true, refreshCardKey: true };

  const flipInner = root.querySelector<HTMLElement>(".flip-card-inner");
  if (flipInner) {
    const revealed = flipInner.classList.contains("flipped");
    return { revealed, refreshCardKey: !revealed };
  }

  const buttonLabels = Array.from(root.querySelectorAll("button"))
    .map((button) => normalizeText(button.textContent));
  const fastFlip = buttonLabels.includes("Sabia") && buttonLabels.includes("Não Sabia");
  if (fastFlip) return { revealed: true, refreshCardKey: true };

  const feedbackVisible = Boolean(root.querySelector('[role="status"]'));
  return { revealed: feedbackVisible, refreshCardKey: !feedbackVisible };
}

function ExplanationSection({
  icon,
  title,
  children,
  warning = false,
}: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <section
      className={warning
        ? "rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"
        : "rounded-xl border border-border/70 bg-muted/20 p-3"}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={warning ? "text-amber-500" : "text-primary"}>{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wide text-foreground">{title}</h3>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
        {children}
      </div>
    </section>
  );
}

export function DesktopDetailedExplanationPanel({
  explanation,
  usageNotes,
  commonMistakes,
}: DesktopDetailedExplanationPanelProps) {
  const location = useLocation();
  const { userId } = useAuthUser();
  const markerRef = useRef<HTMLSpanElement>(null);
  const layoutRef = useRef<HTMLElement | null>(null);
  const cardKeyRef = useRef("");
  const [isDesktop, setIsDesktop] = useState(() =>
    typeof window !== "undefined" && window.matchMedia("(min-width: 1280px)").matches,
  );
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [buttonHost, setButtonHost] = useState<HTMLElement | null>(null);
  const [mode, setMode] = useState<ExplanationDisplayMode>("on_demand");
  const [cardStates, setCardStates] = useState<Record<string, boolean>>({});
  const [cardKey, setCardKey] = useState("");
  const [importantTerms, setImportantTerms] = useState<string[]>([]);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const scope = useMemo(
    () => resolveExplanationScope(location.pathname),
    [location.pathname],
  );
  const localKey = useMemo(
    () => scope ? explanationStorageKey(scope, userId) : null,
    [scope, userId],
  );
  const hasWrittenContent = Boolean(
    normalizeText(explanation) || normalizeText(usageNotes) || normalizeText(commonMistakes),
  );
  const hasContent = hasWrittenContent || importantTerms.length > 0;

  useEffect(() => {
    const media = window.matchMedia("(min-width: 1280px)");
    const handleChange = () => setIsDesktop(media.matches);
    handleChange();
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  useLayoutEffect(() => {
    if (!isDesktop) return;

    const layout = markerRef.current?.previousElementSibling as HTMLElement | null;
    if (!layout) return;
    layoutRef.current = layout;
    layout.classList.add("study-explanation-layout");

    const nextPanelHost = document.createElement("div");
    nextPanelHost.className = "study-explanation-panel-host";
    nextPanelHost.setAttribute("data-study-explanation-panel-host", "true");
    layout.appendChild(nextPanelHost);
    setPanelHost(nextPanelHost);

    let frame = 0;
    let attempts = 0;
    const attachButtonHost = () => {
      const toolsSlot = layout.querySelector<HTMLElement>("[data-study-tools-slot='true']");
      if (toolsSlot) {
        const nextButtonHost = document.createElement("div");
        nextButtonHost.className = "study-explanation-button-host hidden xl:block";
        nextButtonHost.setAttribute("data-study-explanation-button-host", "true");
        toolsSlot.appendChild(nextButtonHost);
        setButtonHost(nextButtonHost);
        return;
      }

      attempts += 1;
      if (attempts < 12) frame = window.requestAnimationFrame(attachButtonHost);
    };
    frame = window.requestAnimationFrame(attachButtonHost);

    return () => {
      window.cancelAnimationFrame(frame);
      layout.classList.remove("study-explanation-layout");
      layout.querySelector("[data-study-explanation-button-host='true']")?.remove();
      nextPanelHost.remove();
      layoutRef.current = null;
      setPanelHost(null);
      setButtonHost(null);
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
        const answerState = inspectAnswerState(root, location.search);
        const prompt = extractPrompt(root);
        const candidateKey = explanationCardKey([
          scope?.type ?? "unknown",
          scope?.id ?? "unknown",
          prompt,
          normalizeText(explanation),
          normalizeText(usageNotes),
          normalizeText(commonMistakes),
        ].join("|"));

        if (answerState.refreshCardKey || !cardKeyRef.current) {
          cardKeyRef.current = candidateKey;
          setCardKey(candidateKey);
        }

        setImportantTerms(extractImportantTerms(root));
        setAnswerRevealed(answerState.revealed);
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ["class", "disabled", "aria-expanded"],
    });

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [
    isDesktop,
    scope,
    explanation,
    usageNotes,
    commonMistakes,
    location.search,
  ]);

  useEffect(() => {
    if (!isDesktop || !scope || !localKey) return;

    const local = readLocalExplanationPreference(localKey);
    setMode(local.mode);
    setCardStates(local.cards);

    if (!userId) return;
    let active = true;
    void loadRemoteExplanationPreference(userId, scope).then((remote) => {
      if (!active || !remote) return;
      const next = {
        mode: remote.mode ?? local.mode,
        cards: { ...local.cards, ...remote.cards },
      };
      setMode(next.mode);
      setCardStates(next.cards);
      saveLocalExplanationPreference(localKey, next);
    });

    return () => {
      active = false;
    };
  }, [isDesktop, localKey, scope, userId]);

  useEffect(() => {
    if (!cardKey || !hasContent || mode === "off") {
      setIsOpen(false);
      return;
    }

    const explicitState = cardStates[cardKey];
    setIsOpen(mode === "always" ? explicitState !== false : explicitState === true);
  }, [cardKey, cardStates, hasContent, mode]);

  const persistMode = useCallback((nextMode: ExplanationDisplayMode) => {
    setMode(nextMode);
    if (localKey) {
      saveLocalExplanationPreference(localKey, { mode: nextMode, cards: cardStates });
    }
    if (userId && scope) {
      void saveRemoteExplanationMode(userId, scope, nextMode);
    }
  }, [cardStates, localKey, scope, userId]);

  const persistCardState = useCallback((nextOpen: boolean, modeOverride = mode) => {
    if (!cardKey) return;
    const nextCards = { ...cardStates, [cardKey]: nextOpen };
    setCardStates(nextCards);
    setIsOpen(nextOpen);
    if (localKey) {
      saveLocalExplanationPreference(localKey, { mode: modeOverride, cards: nextCards });
    }
    if (userId && scope) {
      void saveRemoteExplanationCard(userId, scope, cardKey, nextOpen);
    }
  }, [cardKey, cardStates, localKey, mode, scope, userId]);

  const togglePanel = useCallback(() => {
    if (!hasContent || !cardKey) return;
    const nextMode = mode === "off" ? "on_demand" : mode;
    if (nextMode !== mode) persistMode(nextMode);
    persistCardState(!isOpen, nextMode);
  }, [cardKey, hasContent, isOpen, mode, persistCardState, persistMode]);

  useEffect(() => {
    if (!isDesktop) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']")) return;

      if (event.altKey && event.key.toLocaleLowerCase() === "e" && hasContent) {
        event.preventDefault();
        event.stopImmediatePropagation();
        togglePanel();
      } else if (event.key === "Escape" && isOpen) {
        event.preventDefault();
        event.stopImmediatePropagation();
        persistCardState(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [hasContent, isDesktop, isOpen, persistCardState, togglePanel]);

  const handleModeChange = (nextMode: ExplanationDisplayMode) => {
    persistMode(nextMode);
    if (nextMode === "off") {
      setIsOpen(false);
    } else if (nextMode === "always") {
      persistCardState(true, nextMode);
    }
  };

  const button = isDesktop && hasContent ? (
    <Button
      type="button"
      variant={isOpen ? "secondary" : "outline"}
      size="sm"
      className="study-tools-inline-button h-9 min-w-9 gap-1.5 px-2.5"
      title="Abrir ou fechar explicação detalhada (Alt+E)"
      aria-label="Abrir ou fechar explicação detalhada"
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        togglePanel();
      }}
    >
      <BookOpen className="h-4 w-4" />
      <span className="hidden 2xl:inline text-xs">Explicação</span>
    </Button>
  ) : null;

  const panel = isDesktop && isOpen && hasContent ? (
    <aside className="study-explanation-panel" aria-label="Explicação detalhada do card">
      <header className="flex items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold">Explicação</h2>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Material complementar deste card</p>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8 shrink-0"
          onClick={() => persistCardState(false)}
          aria-label="Fechar explicação"
        >
          <X className="h-4 w-4" />
        </Button>
      </header>

      <div className="border-b border-border/70 px-4 py-2.5">
        <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
          Exibição nesta lista
          <select
            value={mode}
            onChange={(event) => handleModeChange(event.target.value as ExplanationDisplayMode)}
            className="h-8 rounded-md border border-input bg-background px-2 text-xs text-foreground"
          >
            <option value="off">Desativada</option>
            <option value="on_demand">Ao solicitar</option>
            <option value="always">Sempre aberta</option>
          </select>
        </label>
      </div>

      <div className="max-h-[68vh] space-y-3 overflow-y-auto overscroll-contain p-4">
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
            {normalizeText(explanation) && (
              <ExplanationSection icon={<BookOpen className="h-4 w-4" />} title="Explicação detalhada">
                {explanation}
              </ExplanationSection>
            )}
            {normalizeText(usageNotes) && (
              <ExplanationSection icon={<Info className="h-4 w-4" />} title="Como usar">
                {usageNotes}
              </ExplanationSection>
            )}
            {normalizeText(commonMistakes) && (
              <ExplanationSection
                icon={<AlertTriangle className="h-4 w-4" />}
                title="Erros comuns"
                warning
              >
                {commonMistakes}
              </ExplanationSection>
            )}
            {importantTerms.length > 0 && (
              <ExplanationSection icon={<Tags className="h-4 w-4" />} title="Palavras importantes">
                <div className="flex flex-wrap gap-1.5">
                  {importantTerms.map((term) => (
                    <span
                      key={term}
                      className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-foreground"
                    >
                      {term}
                    </span>
                  ))}
                </div>
                <p className="mt-2 text-[11px]">
                  Clique nas palavras sublinhadas do card para consultar as traduções.
                </p>
              </ExplanationSection>
            )}
          </>
        )}
      </div>
    </aside>
  ) : null;

  return (
    <>
      <span ref={markerRef} className="hidden" aria-hidden="true" />
      {buttonHost && button ? createPortal(button, buttonHost) : null}
      {panelHost && panel ? createPortal(panel, panelHost) : null}
    </>
  );
}
