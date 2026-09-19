import type { ComponentProps, ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Barra de ações compartilhada pelos modos de estudo.
 *
 * Regras (mobile-first) que valem para TODOS os modos:
 * - nenhum botão de ação quebra o rótulo em duas linhas;
 * - a ação primária ocupa a largura toda no mobile e fica à direita no desktop;
 * - as secundárias ficam numa linha própria no mobile, dividindo o espaço;
 * - toda ação tem no mínimo 44px de altura (área de toque confortável).
 *
 * Isso elimina as soluções especiais que faziam cada modo parecer um produto
 * diferente (botões espremidos, alturas divergentes, labels em 2-3 linhas).
 */
export function StudyActionBar({
  primary,
  secondary,
  className,
}: {
  primary?: ReactNode;
  secondary?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-study-action-bar="true"
      className={cn(
        "flex w-full flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-2.5",
        className,
      )}
    >
      {secondary ? (
        <div className="flex w-full items-stretch gap-2 sm:w-auto sm:shrink-0">
          {secondary}
        </div>
      ) : null}
      {primary ? <div className="flex w-full sm:w-auto sm:shrink-0">{primary}</div> : null}
    </div>
  );
}

type StudyActionTone = "primary" | "secondary" | "ghost" | "danger";

const TONE_CLASS: Record<StudyActionTone, string> = {
  primary: "",
  secondary: "",
  ghost: "text-muted-foreground",
  danger: "",
};

const TONE_VARIANT: Record<StudyActionTone, ComponentProps<typeof Button>["variant"]> = {
  primary: "default",
  secondary: "outline",
  ghost: "ghost",
  danger: "destructive",
};

/**
 * Botão de ação dos modos de estudo.
 *
 * `compactLabel` é usado no mobile quando o rótulo longo prejudicaria a
 * largura; `hideLabelOnMobile` deixa só o ícone (sempre com aria-label).
 */
export function StudyActionButton({
  tone = "secondary",
  icon,
  label,
  compactLabel,
  hideLabelOnMobile = false,
  className,
  ...props
}: Omit<ComponentProps<typeof Button>, "variant" | "children"> & {
  tone?: StudyActionTone;
  icon?: ReactNode;
  label: string;
  compactLabel?: string;
  hideLabelOnMobile?: boolean;
}) {
  return (
    <Button
      {...props}
      variant={TONE_VARIANT[tone]}
      title={props.title ?? label}
      aria-label={props["aria-label"] ?? label}
      className={cn(
        "h-11 min-h-11 flex-1 rounded-xl px-3 text-sm font-semibold touch-manipulation sm:flex-none sm:px-4",
        tone === "ghost" && "font-medium",
        TONE_CLASS[tone],
        className,
      )}
    >
      {icon ? <span className="mr-1.5 inline-flex h-4 w-4 shrink-0 items-center justify-center">{icon}</span> : null}
      <span className={cn("whitespace-nowrap", hideLabelOnMobile && "hidden sm:inline")}>
        {compactLabel ? (
          <>
            <span className="sm:hidden">{compactLabel}</span>
            <span className="hidden sm:inline">{label}</span>
          </>
        ) : label}
      </span>
    </Button>
  );
}

