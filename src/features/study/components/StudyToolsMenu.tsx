import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Flame, Gauge, Gem, Lightbulb, Loader2, RotateCcw, Settings2, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthUser } from "@/hooks/useAuthUser";
import type { SpecialFocusTag } from "@/hooks/useSpecialFlashcards";
import { buildStudyHintContent } from "@/features/study/lib/buildStudyHintContent";
import {
  getCurrentDetailedExplanation,
  subscribeCurrentDetailedExplanation,
} from "@/features/study/lib/currentDetailedExplanation";
import { clearPendingSpecialFocusDraft, savePendingSpecialFocusDraft } from "@/features/study/lib/specialFocusDraft";
import { HintModal } from "./HintModal";
import "./study-tools-menu.css";

const SPEECH_RATE_KEY = "speechRate";
const TOOL_EMOJI = {
  favorite: "\u{2B50}",
  redList: "\u{1F525}",
  special: "\u{1F48E}",
  hint: "\u{1F4A1}",
} as const;

const FOCUS_TAGS: Array<{ value: SpecialFocusTag; label: string }> = [
  { value: "grammar", label: "Gramática" },
  { value: "vocabulary", label: "Vocabulário" },
  { value: "expression", label: "Expressão" },
  { value: "phrasal_verb", label: "Phrasal verb" },
  { value: "pronunciation", label: "Pronúncia" },
  { value: "translation", label: "Tradução" },
  { value: "natural_usage", label: "Uso natural" },
  { value: "other", label: "Outro" },
];

function readRate(): number {
  if (typeof window === "undefined") return 1;
  return Number(localStorage.getItem(SPEECH_RATE_KEY) || "1");
}

function readSelectedText(): string {
  if (typeof window === "undefined") return "";
  const text = window.getSelection?.()?.toString() ?? "";
  return text.replace(/\s+/g, " ").trim().slice(0, 240);
}

interface StudyToolsMenuProps {
  hint?: string | null;
  isFavorite?: boolean;
  onToggleFavorite?: () => void;
  isRedListed?: boolean;
  onToggleRedList?: () => void;
  isSpecial?: boolean;
  onToggleSpecial?: () => void;
  favoritePending?: boolean;
  redListPending?: boolean;
  specialPending?: boolean;
  onRestartRound?: () => void;
  onRestartJourney?: () => void;
  className?: string;
}

function stopCardInteraction(event: React.SyntheticEvent) {
  event.preventDefault();
  event.stopPropagation();
}

function EmojiIcon({
  value,
  className,
}: {
  value: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn("inline-flex h-5 min-w-5 items-center justify-center text-[1.05rem] leading-none", className)}
    >
      {value}
    </span>
  );
}

function InlineToolButton({
  icon,
  label,
  active,
  disabled,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "outline"}
      size="sm"
      disabled={disabled}
      className={cn(
        "study-tools-inline-button h-9 min-w-9 gap-1.5 px-2.5",
        active && "border-primary/60 bg-primary/10 text-primary",
      )}
      title={label}
      aria-label={label}
      onPointerDown={stopCardInteraction}
      onClick={(event) => {
        stopCardInteraction(event);
        if (!disabled) onClick?.();
      }}
    >
      {icon}
      <span className="hidden 2xl:inline text-xs">{label}</span>
    </Button>
  );
}

export function StudyToolsMenu({
  hint,
  isFavorite,
  onToggleFavorite,
  isRedListed,
  onToggleRedList,
  isSpecial,
  onToggleSpecial,
  favoritePending,
  redListPending,
  specialPending,
  onRestartRound,
  onRestartJourney,
  className,
}: StudyToolsMenuProps) {
  const { user } = useAuthUser();
  const hasAccount = Boolean(user?.id);
  const [showHint, setShowHint] = useState(false);
  const [rate, setRate] = useState<number>(() => readRate());
  const [specialFocusOpen, setSpecialFocusOpen] = useState(false);
  const [focusText, setFocusText] = useState("");
  const [focusTag, setFocusTag] = useState<SpecialFocusTag | null>(null);
  const [focusNote, setFocusNote] = useState("");
  const savingSpecialFocusRef = useRef(false);
  const anchorRef = useRef<HTMLSpanElement>(null);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const detailed = useSyncExternalStore(
    subscribeCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
    getCurrentDetailedExplanation,
  );
  const combinedHint = buildStudyHintContent({
    hint,
    detailed_explanation: detailed.explanation,
    usage_notes: detailed.usageNotes,
    common_mistakes: detailed.commonMistakes,
  });

  useLayoutEffect(() => {
    const anchor = anchorRef.current;
    const modeRoot = anchor?.closest(".max-w-2xl");
    if (!modeRoot) return;

    const existing = modeRoot.querySelector<HTMLElement>("[data-study-tools-slot='true']");
    if (existing) {
      setPortalHost(existing);
      return;
    }

    const host = document.createElement("div");
    host.className = "study-tools-portal-slot";
    host.setAttribute("data-study-tools-slot", "true");
    modeRoot.insertBefore(host, modeRoot.firstChild);
    setPortalHost(host);

    return () => {
      setPortalHost(null);
      host.remove();
    };
  }, []);

  useEffect(() => {
    const handler = (event: Event) => {
      const detail = (event as CustomEvent<number>).detail;
      if (typeof detail === "number") setRate(detail);
    };
    window.addEventListener("speechRateChanged", handler as EventListener);
    return () => window.removeEventListener("speechRateChanged", handler as EventListener);
  }, []);

  const toggleRate = () => {
    window.speechSynthesis?.cancel();
    const next = rate === 1 ? 0.5 : 1;
    setRate(next);
    localStorage.setItem(SPEECH_RATE_KEY, String(next));
    window.dispatchEvent(new CustomEvent("speechRateChanged", { detail: next }));
  };

  const openSpecialFocusDialog = () => {
    if (specialPending) return;
    clearPendingSpecialFocusDraft();
    setFocusText(readSelectedText());
    setFocusTag(null);
    setFocusNote("");
    setSpecialFocusOpen(true);
  };

  const closeSpecialFocusDialog = () => {
    savingSpecialFocusRef.current = false;
    clearPendingSpecialFocusDraft();
    setSpecialFocusOpen(false);
  };

  const handleSaveSpecialFocus = () => {
    if (specialPending || !onToggleSpecial) return;
    savingSpecialFocusRef.current = true;
    savePendingSpecialFocusDraft({
      focus_text: focusText,
      focus_tag: focusTag,
      focus_note: focusNote,
    });
    setSpecialFocusOpen(false);
    onToggleSpecial();
    setTimeout(() => {
      savingSpecialFocusRef.current = false;
    }, 0);
  };

  const handleRemoveSpecial = () => {
    if (specialPending || !onToggleSpecial) return;
    clearPendingSpecialFocusDraft();
    setSpecialFocusOpen(false);
    onToggleSpecial();
  };

  const handleSpecialDialogOpenChange = (open: boolean) => {
    setSpecialFocusOpen(open);
    if (!open && !savingSpecialFocusRef.current) {
      clearPendingSpecialFocusDraft();
    }
  };

  const hasHint = !!combinedHint && combinedHint.trim().length > 0;
  const anyActive = hasAccount && (!!isFavorite || !!isRedListed || !!isSpecial);
  const hasSessionActions = Boolean(onRestartRound || onRestartJourney);
  const hasFocusContent = Boolean(focusText.trim() || focusTag || focusNote.trim());
  const rateLabel = rate === 1
    ? "Velocidade da fala: natural (1x)"
    : "Fala didática: palavras separadas e termos difíceis articulados em partes (0.5x)";

  const favoriteIcon = favoritePending
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : isFavorite
      ? <EmojiIcon value={TOOL_EMOJI.favorite} />
      : <Star className="h-4 w-4 text-muted-foreground" />;

  const redListIcon = redListPending
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : isRedListed
      ? <EmojiIcon value={TOOL_EMOJI.redList} />
      : <Flame className="h-4 w-4 text-muted-foreground" />;

  const specialIcon = specialPending
    ? <Loader2 className="h-4 w-4 animate-spin" />
    : isSpecial
      ? <EmojiIcon value={TOOL_EMOJI.special} />
      : <Gem className="h-4 w-4 text-muted-foreground" />;

  const hintIcon = hasHint
    ? <EmojiIcon value={TOOL_EMOJI.hint} />
    : <Lightbulb className="h-4 w-4 text-muted-foreground" />;

  const specialFocusDialog = (
    <Dialog open={specialFocusOpen} onOpenChange={handleSpecialDialogOpenChange}>
      <DialogContent
        hideClose
        className="bottom-0 top-auto flex max-h-[86vh] max-w-none translate-y-0 flex-col gap-0 overflow-hidden rounded-t-2xl p-0 sm:bottom-auto sm:top-[50%] sm:max-w-lg sm:translate-y-[-50%] sm:rounded-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <DialogHeader className="border-b px-4 pb-3 pt-4 text-left sm:px-5">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <Gem className="h-4 w-4 text-primary" />
            Pedir explicação
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Marque o trecho que a IA deve explicar.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-3 sm:px-5">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Trecho específico</label>
            <Input
              value={focusText}
              onChange={(event) => setFocusText(event.target.value)}
              placeholder="Ex: is used to, would rather, get used to..."
              className="h-10 text-sm"
            />
            <p className="text-[11px] text-muted-foreground">Selecionar texto antes de abrir já preenche este campo.</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-semibold text-muted-foreground">Tipo de dúvida</div>
              {focusTag && (
                <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[11px]" onClick={() => setFocusTag(null)}>
                  Limpar
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              {FOCUS_TAGS.map((tag) => (
                <Button
                  key={tag.value}
                  type="button"
                  variant={focusTag === tag.value ? "default" : "outline"}
                  size="sm"
                  className="h-9 min-w-0 px-2 text-xs"
                  onClick={() => setFocusTag(tag.value)}
                >
                  <span className="truncate">{tag.label}</span>
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Observação opcional</label>
            <Textarea
              value={focusNote}
              onChange={(event) => setFocusNote(event.target.value)}
              placeholder="Ex: aluno confunde com used to + verbo no passado."
              className="min-h-[72px] resize-none text-sm"
            />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t bg-background px-4 py-3 sm:flex-row sm:justify-between sm:px-5">
          {isSpecial ? (
            <Button type="button" variant="destructive" size="sm" onClick={handleRemoveSpecial} disabled={specialPending}>
              Remover
            </Button>
          ) : <span className="hidden sm:block" />}
          <div className="flex gap-2 sm:ml-auto">
            <Button type="button" variant="ghost" size="sm" className="flex-1 sm:flex-none" onClick={closeSpecialFocusDialog}>
              Cancelar
            </Button>
            <Button type="button" size="sm" className="flex-1 sm:flex-none" onClick={handleSaveSpecialFocus} disabled={specialPending}>
              {hasFocusContent ? "Salvar foco" : "Salvar especial"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );

  const mobileMenu = (
    <div className="flex items-center gap-2 md:hidden">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="study-tools-inline-button h-9 min-w-[4.25rem] gap-1.5 px-2.5"
        title={rateLabel}
        aria-label={`${rateLabel}. Toque para alternar.`}
        onPointerDown={stopCardInteraction}
        onClick={(event) => {
          stopCardInteraction(event);
          toggleRate();
        }}
      >
        <Gauge className="h-4 w-4" />
        <span className="text-xs font-semibold">{rate === 1 ? "1x" : "0.5x"}</span>
      </Button>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className={cn(
              "study-tools-floating-trigger h-9 w-10 px-0 shrink-0",
              anyActive && "border-primary/60",
              className,
            )}
            onClick={stopCardInteraction}
            title="Ferramentas do card"
            aria-label="Ferramentas do card"
          >
            <Settings2 className="h-4 w-4" />
            {anyActive && <span aria-hidden className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64" onClick={(event) => event.stopPropagation()}>
          <DropdownMenuLabel>Ferramentas</DropdownMenuLabel>
          <DropdownMenuSeparator />

          {hasAccount && onToggleFavorite && (
            <DropdownMenuItem
              disabled={favoritePending}
              onSelect={(event) => {
                event.preventDefault();
                if (!favoritePending) onToggleFavorite();
              }}
            >
              <span className="mr-2 inline-flex w-5 justify-center">{favoriteIcon}</span>
              {isFavorite ? "Remover dos favoritos" : "Favoritar"}
            </DropdownMenuItem>
          )}

          {hasAccount && onToggleRedList && (
            <DropdownMenuItem
              disabled={redListPending || !isFavorite}
              onSelect={(event) => {
                event.preventDefault();
                if (!redListPending && isFavorite) onToggleRedList();
              }}
            >
              <span className="mr-2 inline-flex w-5 justify-center">{redListIcon}</span>
              {!isFavorite
                ? "Lista Vermelha — favorite primeiro"
                : isRedListed
                  ? "Sair da Lista Vermelha"
                  : "Lista Vermelha"}
            </DropdownMenuItem>
          )}

          {hasAccount && onToggleSpecial && (
            <DropdownMenuItem
              disabled={specialPending}
              onSelect={(event) => {
                event.preventDefault();
                if (!specialPending) openSpecialFocusDialog();
              }}
            >
              <span className="mr-2 inline-flex w-5 justify-center">{specialIcon}</span>
              {isSpecial ? "Editar foco especial" : "Pedir explicação"}
            </DropdownMenuItem>
          )}

          {hasAccount && (onToggleFavorite || onToggleSpecial) && <DropdownMenuSeparator />}

          <DropdownMenuItem
            disabled={!hasHint}
            onSelect={(event) => {
              event.preventDefault();
              if (hasHint) setShowHint(true);
            }}
          >
            <span className="mr-2 inline-flex w-5 justify-center">{hintIcon}</span>
            {hasHint ? "Ver dica e explicação" : "Sem dica"}
          </DropdownMenuItem>

          {hasSessionActions && <DropdownMenuSeparator />}
          {onRestartRound && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onRestartRound();
              }}
            >
              <RotateCcw className="mr-2 h-4 w-4" />
              Reiniciar rodada
            </DropdownMenuItem>
          )}
          {onRestartJourney && (
            <DropdownMenuItem
              onSelect={(event) => {
                event.preventDefault();
                onRestartJourney();
              }}
            >
              <Settings2 className="mr-2 h-4 w-4" />
              Reiniciar percurso
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );

  const desktopTools = (
    <div className={cn("study-tools-desktop-actions hidden md:flex items-center justify-end gap-1.5", className)}>
      {hasAccount && onToggleFavorite && (
        <InlineToolButton
          label={isFavorite ? "Remover favorito" : "Favoritar"}
          active={isFavorite}
          disabled={favoritePending}
          onClick={onToggleFavorite}
          icon={favoriteIcon}
        />
      )}
      {hasAccount && onToggleRedList && (
        <InlineToolButton
          label={!isFavorite ? "Favorite primeiro" : isRedListed ? "Sair da Lista Vermelha" : "Lista Vermelha"}
          active={isRedListed}
          disabled={redListPending || !isFavorite}
          onClick={onToggleRedList}
          icon={redListIcon}
        />
      )}
      {hasAccount && onToggleSpecial && (
        <InlineToolButton
          label={isSpecial ? "Editar foco especial" : "Pedir explicação"}
          active={isSpecial}
          disabled={specialPending}
          onClick={openSpecialFocusDialog}
          icon={specialIcon}
        />
      )}
      <InlineToolButton
        label={hasHint ? "Dica e explicação" : "Sem dica"}
        disabled={!hasHint}
        onClick={() => setShowHint(true)}
        icon={hintIcon}
      />
      <InlineToolButton
        label={rate === 1 ? "Velocidade natural" : "Fala didática"}
        onClick={toggleRate}
        icon={
          <span className="inline-flex items-center gap-1 text-xs font-semibold">
            <Gauge className="h-4 w-4" />
            {rate === 1 ? "1x" : "0.5x"}
          </span>
        }
      />
      {hasSessionActions && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" size="sm" className="h-9 w-9 px-0" aria-label="Configurações da sessão">
              <Settings2 className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Configurações da sessão</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {onRestartRound && (
              <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onRestartRound(); }}>
                <RotateCcw className="mr-2 h-4 w-4" /> Reiniciar rodada
              </DropdownMenuItem>
            )}
            {onRestartJourney && (
              <DropdownMenuItem onSelect={(event) => { event.preventDefault(); onRestartJourney(); }}>
                Reiniciar percurso
              </DropdownMenuItem>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );

  return (
    <>
      <span ref={anchorRef} className="study-tools-anchor-placeholder" aria-hidden="true" />
      {portalHost ? createPortal(<>{mobileMenu}{desktopTools}</>, portalHost) : null}
      {specialFocusDialog}
      <HintModal hint={combinedHint} isOpen={showHint} onClose={() => setShowHint(false)} />
    </>
  );
}
