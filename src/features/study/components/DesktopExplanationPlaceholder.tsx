import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, BookOpen, Info, LockKeyhole, Tags, X } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  loadRemoteExplanationPreference,
  saveRemoteExplanationCard,
  saveRemoteExplanationMode,
} from "./StudyToolsMenuWithExplanation";

export type ExplanationDisplayMode = "off" | "on_demand" | "always";

interface DesktopExplanationPlaceholderProps {
  explanation?: string | null;
  usageNotes?: string | null;
  commonMistakes?: string | null;
}

interface SavedState {
  mode: ExplanationDisplayMode;
  cards: Record<string, boolean>;
}

function normalize(value: unknown): string {
  return String(value ?? "").trim().replace(/\s+/g, " ");
}

function getScope(pathname: string): string {
  const parts = pathname.split("/").filter(Boolean);
  const listIndex = parts.indexOf("list");
  if (listIndex >= 0) return `list:${parts[listIndex + 1] ?? "unknown"}`;
  const collectionIndex = parts.indexOf("collection");
  if (collectionIndex >= 0) return `collection:${parts[collectionIndex + 1] ?? "unknown"}`;
  return "unknown:unknown";
}

function compactKey(value: string): string {
  let hash = 5381;
  for (let index = 0; index < value.length; index += 1) {
    hash = ((hash << 5) + hash) ^ value.charCodeAt(index);
  }
  return (hash >>> 0).toString(36);
}

function normalizeMode(value: unknown): ExplanationDisplayMode {
  return value === "off" || value === "always" || value === "on_demand" ? value : "on_demand";
}

function readSaved(key: string): SavedState {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || "null") as Partial<SavedState> | null;
    return {
      mode: normalizeMode(parsed?.mode),
      cards: parsed?.cards && typeof parsed.cards === "object" ? parsed.cards as Record<string, boolean> : {},
    };
  } catch {
    return { mode: "on_demand", cards: {} };
  }
}

function writeSaved(key: string, value: SavedState): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // The database remains authoritative for signed-in users.
  }
}

function Section({ icon, title, children, warning = false }: {
  icon: ReactNode;
  title: string;
  children: ReactNode;
  warning?: boolean;
}) {
  return (
    <section className={warning
      ? "rounded-xl border border-amber-500/25 bg-amber-500/5 p-3"
      : "rounded-xl border border-border/70 bg-muted/20 p-3"}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className={warning ? "text-amber-500" : "text-primary"}>{icon}</span>
        <h3 className="text-xs font-bold uppercase tracking-wide">{title}</h3>
      </div>
      <div className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}

export function DesktopExplanationPlaceholder({
  explanation,
  usageNotes,
  commonMistakes,
}: DesktopExplanationPlaceholderProps) {
  const location = useLocation();
  const markerRef = useRef<HTMLSpanElement>(null);
  const layoutRef = useRef<HTMLElement | null>(null);
  const [panelHost, setPanelHost] = useState<HTMLElement | null>(null);
  const [buttonHost, setButtonHost] = useState<HTMLElement | null>(null);
  const scope = useMemo(() => getScope(location.pathname), [location.pathname]);
  const [scopeType, scopeId] = scope.split(":") as ["list" | "collection", string];
  const storageKey = `studyExplanation:${scope}`;
  const initial = useMemo(() => readSaved(storageKey), [storageKey]);
  const [mode, setMode] = useState<ExplanationDisplayMode>(initial.mode);
  const [cards, setCards] = useState<Record<string, boolean>>(initial.cards);
  const [cardKey, setCardKey] = useState("");
  const [terms, setTerms] = useState<string[]>([]);
  const [revealed, setRevealed] = useState(false);
  const [open, setOpen] = useState(false);

  const hasText = Boolean(normalize(explanation) || normalize(usageNotes) || normalize(commonMistakes));
  const hasContent = hasText || terms.length > 0;

  useLayoutEffect(() => {
    const layout = markerRef.current?.previousElementSibling as HTMLElement | null;
    if (!layout) return;
    layoutRef.current = layout;
    layout.classList.add("study-explanation-layout");

    const panel = document.createElement("div");
    panel.className = "study-explanation-panel-host";
    layout.appendChild(panel);
    setPanelHost(panel);

    const frame = requestAnimationFrame(() => {
      const slot = layout.querySelector<HTMLElement>("[data-study-tools-slot='true']");
      if (!slot) return;
      const button = document.createElement("div");
      button.className = "study-explanation-button-host hidden xl:block";
      slot.appendChild(button);
      setButtonHost(button);
    });

    return () => {
      cancelAnimationFrame(frame);
      panel.remove();
      layout.querySelector(".study-explanation-button-host")?.remove();
      layout.classList.remove("study-explanation-layout");
      layoutRef.current = null;
    };
  }, []);

  useEffect(() => {
    const root = layoutRef.current?.querySelector<HTMLElement>(".max-w-2xl");
    if (!root) return;
    let frame = 0;

    const refresh = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const prompt = normalize(
          root.querySelector<HTMLElement>(".flip-card-front p.text-xl, h2, p.font-bold, p.font-semibold")?.textContent
            || root.textContent,
        ).slice(0, 500);
        const signature = [scope, prompt, explanation, usageNotes, commonMistakes].map(normalize).join("|");
        setCardKey(compactKey(signature));

        const foundTerms = new Map<string, string>();
        root.querySelectorAll<HTMLButtonElement>('button[aria-label*=": abrir "]').forEach((button) => {
          const value = (button.getAttribute("aria-label") || "").split(": abrir ")[0]?.trim();
          if (value) foundTerms.set(value.toLocaleLowerCase(), value);
        });
        setTerms(Array.from(foundTerms.values()).slice(0, 12));

        const flip = root.querySelector<HTMLElement>(".flip-card-inner");
        const text = normalize(root.textContent);
        const fastFlip = text.includes("Não Sabia") && text.includes("Sabia") && !flip;
        const feedback = Boolean(root.querySelector('[role="status"][class*="border-l-"]'));
        const pronunciation = new URLSearchParams(location.search).get("mode") === "pronunciation";
        setRevealed(pronunciation || fastFlip || feedback || Boolean(flip?.classList.contains("flipped")));
      });
    };

    refresh();
    const observer = new MutationObserver(refresh);
    observer.observe(root, { subtree: true, childList: true, attributes: true, attributeFilter: ["class", "disabled"] });
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [scope, explanation, usageNotes, commonMistakes, location.search]);

  useEffect(() => {
    const local = readSaved(storageKey);
    setMode(local.mode);
    setCards(local.cards);

    if (scopeId === "unknown") return;
    let active = true;
    void loadRemoteExplanationPreference(scopeType, scopeId).then((remote) => {
      if (!active || !remote) return;
      const next = {
        mode: remote.mode ? normalizeMode(remote.mode) : local.mode,
        cards: { ...local.cards, ...remote.cards },
      };
      setMode(next.mode);
      setCards(next.cards);
      writeSaved(storageKey, next);
    });
    return () => { active = false; };
  }, [scopeId, scopeType, storageKey]);

  useEffect(() => {
    if (!cardKey || !hasContent || mode === "off") {
      setOpen(false);
      return;
    }
    const selected = cards[cardKey];
    setOpen(mode === "always" ? selected !== false : selected === true);
  }, [cardKey, cards, hasContent, mode]);

  const persistMode = (nextMode: ExplanationDisplayMode, nextCards = cards) => {
    setMode(nextMode);
    writeSaved(storageKey, { mode: nextMode, cards: nextCards });
    if (scopeId !== "unknown") void saveRemoteExplanationMode(scopeType, scopeId, nextMode);
  };

  const setCardOpen = (nextOpen: boolean, nextMode = mode) => {
    if (!cardKey) return;
    const nextCards = { ...cards, [cardKey]: nextOpen };
    setCards(nextCards);
    setOpen(nextOpen);
    writeSaved(storageKey, { mode: nextMode, cards: nextCards });
    if (scopeId !== "unknown") void saveRemoteExplanationCard(scopeType, scopeId, cardKey, nextOpen);
  };

  const toggle = () => {
    if (!hasContent || !cardKey) return;
    const nextMode = mode === "off" ? "on_demand" : mode;
    if (nextMode !== mode) persistMode(nextMode);
    setCardOpen(!open, nextMode);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, [contenteditable='true']") || innerWidth < 1280) return;
      if (event.key.toLowerCase() === "e" && hasContent) {
        event.preventDefault();
        toggle();
      } else if (event.key === "Escape" && open) {
        event.preventDefault();
        event.stopImmediatePropagation();
        setCardOpen(false);
      }
    };
    addEventListener("keydown", onKey, true);
    return () => removeEventListener("keydown", onKey, true);
  });

  const button = hasContent ? (
    <Button type="button" variant={open ? "secondary" : "outline"} size="sm"
      className="study-tools-inline-button h-9 min-w-9 gap-1.5 px-2.5"
      onClick={(event) => { event.preventDefault(); event.stopPropagation(); toggle(); }}
      aria-label="Abrir ou fechar explicação detalhada" title="Explicação detalhada">
      <BookOpen className="h-4 w-4" />
      <span className="hidden 2xl:inline text-xs">Explicação</span>
    </Button>
  ) : null;

  const panel = open && hasContent ? (
    <aside className="study-explanation-panel" aria-label="Explicação detalhada do card">
      <header className="flex items-start justify-between gap-3 border-b px-4 py-3">
        <div><h2 className="flex items-center gap-2 text-sm font-bold"><BookOpen className="h-4 w-4 text-primary" />Explicação</h2>
          <p className="mt-1 text-[11px] text-muted-foreground">Material complementar deste card</p></div>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setCardOpen(false)} aria-label="Fechar explicação"><X className="h-4 w-4" /></Button>
      </header>
      <div className="border-b px-4 py-2.5">
        <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">Exibição nesta lista
          <select value={mode} onChange={(event) => {
            const next = event.target.value as ExplanationDisplayMode;
            persistMode(next);
            if (next === "off") setOpen(false);
            if (next === "always") setCardOpen(true, next);
          }} className="h-8 rounded-md border bg-background px-2 text-xs text-foreground">
            <option value="off">Desativada</option><option value="on_demand">Ao solicitar</option><option value="always">Sempre aberta</option>
          </select>
        </label>
      </div>
      <div className="max-h-[68vh] space-y-3 overflow-y-auto p-4">
        {!revealed ? (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-8 text-center">
            <LockKeyhole className="mx-auto mb-3 h-7 w-7 text-primary" /><p className="text-sm font-semibold">Responda primeiro</p>
            <p className="mt-1 text-xs text-muted-foreground">Revele ou confira a resposta para liberar a explicação.</p>
          </div>
        ) : <>
          {normalize(explanation) && <Section icon={<BookOpen className="h-4 w-4" />} title="Explicação detalhada">{explanation}</Section>}
          {normalize(usageNotes) && <Section icon={<Info className="h-4 w-4" />} title="Como usar">{usageNotes}</Section>}
          {normalize(commonMistakes) && <Section icon={<AlertTriangle className="h-4 w-4" />} title="Erros comuns" warning>{commonMistakes}</Section>}
          {terms.length > 0 && <Section icon={<Tags className="h-4 w-4" />} title="Palavras importantes"><div className="flex flex-wrap gap-1.5">{terms.map((term) => <span key={term} className="rounded-full border bg-background px-2 py-1 text-xs font-medium text-foreground">{term}</span>)}</div><p className="mt-2 text-[11px]">Clique nas palavras sublinhadas do card para consultar as traduções.</p></Section>}
        </>}
      </div>
    </aside>
  ) : null;

  return <><span ref={markerRef} className="hidden" />{buttonHost && button ? createPortal(button, buttonHost) : null}{panelHost && panel ? createPortal(panel, panelHost) : null}</>;
}
