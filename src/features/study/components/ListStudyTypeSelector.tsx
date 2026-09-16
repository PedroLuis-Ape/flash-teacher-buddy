import { useEffect, useRef, useState, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { AlertTriangle, ArrowRightLeft, BookOpen, Calculator, Image, Volume2, VolumeX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { STUDY_TYPE_CONFIG, supportsTTS } from "@/features/study/lib/studyTypeConfig";
import { SUPPORTED_LANGUAGES, getLangLabel, normalizeLangCode } from "@/features/study/lib/languages";
import type { LanguageSettingsMode } from "@/features/study/lib/resolveStudySides";
import { supabase } from "@/integrations/supabase/client";
import { persistListPrimarySideFromCurrentRoute } from "@/lib/loadListPrimarySide";
import { useListPrimarySide } from "@/lib/useListPrimarySide";

const LANGUAGES = [
  ...SUPPORTED_LANGUAGES.map((language) => ({
    code: language.code,
    name: language.label,
    flag: language.flag,
  })),
  { code: "other", name: "Outro...", flag: "🌍" },
];

export interface ListStudySettings {
  studyType: "language" | "general" | "math" | "visual";
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
  primarySide?: "a" | "b";
  languageSettingsMode?: LanguageSettingsMode;
}

interface ListStudyTypeSelectorProps {
  value: ListStudySettings;
  onChange: (settings: ListStudySettings) => void;
}

const STUDY_TYPE_ICONS: Record<string, ReactNode> = {
  language: <Volume2 className="h-4 w-4" />,
  general: <BookOpen className="h-4 w-4" />,
  math: <Calculator className="h-4 w-4" />,
  visual: <Image className="h-4 w-4" />,
};

const languageName = (code: string) => getLangLabel(code);

function isLanguageSettingsMode(value: unknown): value is LanguageSettingsMode {
  return value === "explicit" || value === "inherited" || value === "legacy";
}

function isMissingLanguageSettingsMode(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const record = error as { message?: unknown; details?: unknown; hint?: unknown };
  return [record.message, record.details, record.hint]
    .filter((part) => typeof part === "string")
    .join(" ")
    .toLocaleLowerCase()
    .includes("language_settings_mode");
}

export function ListStudyTypeSelector({ value, onChange }: ListStudyTypeSelectorProps) {
  const { id } = useParams();
  const showPrimarySide = window.location.pathname.startsWith("/list/");
  const { side: savedPrimarySide, loading: primarySideLoading } = useListPrimarySide(
    showPrimarySide ? id || null : null,
  );
  const hydratedListRef = useRef<string | null>(null);
  const valueRef = useRef(value);
  const onChangeRef = useRef(onChange);
  valueRef.current = value;
  onChangeRef.current = onChange;

  const [customLangA, setCustomLangA] = useState("");
  const [customLangB, setCustomLangB] = useState("");
  const [showCustomA, setShowCustomA] = useState(false);
  const [showCustomB, setShowCustomB] = useState(false);
  const [languageModeSupported, setLanguageModeSupported] = useState<boolean | null>(null);

  useEffect(() => {
    const knownA = LANGUAGES.some((language) => language.code === value.langA);
    const knownB = LANGUAGES.some((language) => language.code === value.langB);
    if (value.langA && !knownA) {
      setCustomLangA(value.langA);
      setShowCustomA(true);
    }
    if (value.langB && !knownB) {
      setCustomLangB(value.langB);
      setShowCustomB(true);
    }
  }, [value.langA, value.langB]);

  useEffect(() => {
    if (!showPrimarySide || !id || primarySideLoading || hydratedListRef.current === id) return;
    hydratedListRef.current = id;
    const currentSide = value.primarySide === "b" ? "b" : "a";
    if (currentSide !== savedPrimarySide) {
      onChange({ ...value, primarySide: savedPrimarySide });
    }
  }, [id, onChange, primarySideLoading, savedPrimarySide, showPrimarySide, value]);

  // ListDetail predates the authority column and intentionally passes only the
  // classic A/B fields into this reusable selector. Hydrate the authority here
  // on list routes so an inherited row stays inherited and a legacy row can be
  // explicitly promoted without requiring a destructive migration of old data.
  useEffect(() => {
    if (!showPrimarySide || !id) return;
    let cancelled = false;

    void (async () => {
      const result = await (supabase as any)
        .from("lists")
        .select("language_settings_mode")
        .eq("id", id)
        .maybeSingle();

      if (cancelled) return;
      if (result.error) {
        if (isMissingLanguageSettingsMode(result.error)) {
          setLanguageModeSupported(false);
          return;
        }
        console.warn("[ListStudyTypeSelector] Não foi possível carregar a autoridade A/B da lista.", result.error);
        return;
      }

      setLanguageModeSupported(true);
      const mode: LanguageSettingsMode = isLanguageSettingsMode(result.data?.language_settings_mode)
        ? result.data.language_settings_mode
        : "legacy";
      const current = valueRef.current;
      if (current.languageSettingsMode !== mode) {
        onChangeRef.current({ ...current, languageSettingsMode: mode });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [id, showPrimarySide]);

  const primarySide = value.primarySide === "b" ? "b" : "a";
  const isLanguageMode = value.studyType === "language";
  const hasTTS = supportsTTS(value.studyType);
  const isInherited = value.languageSettingsMode === "inherited";
  const update = (patch: Partial<ListStudySettings>) => onChange({ ...value, ...patch });
  const updateStudyMetadata = (patch: Partial<ListStudySettings>) => update({
    ...patch,
    ...(languageModeSupported === false ? {} : { languageSettingsMode: "explicit" as const }),
  });

  const handleStudyTypeChange = (studyType: string) => {
    const config = STUDY_TYPE_CONFIG[studyType];
    if (!config) return;
    if (studyType === "language") {
      updateStudyMetadata({
        studyType: "language",
        ttsEnabled: true,
        labelsA: languageName(value.langA || "en"),
        labelsB: languageName(value.langB || "pt"),
      });
      return;
    }
    updateStudyMetadata({
      studyType: studyType as ListStudySettings["studyType"],
      ttsEnabled: studyType === "visual" ? false : value.ttsEnabled,
      labelsA: config.defaultLabelA,
      labelsB: config.defaultLabelB,
    });
  };

  const chooseLanguage = (side: "a" | "b", code: string) => {
    if (code === "other") {
      side === "a" ? setShowCustomA(true) : setShowCustomB(true);
      return;
    }
    if (side === "a") {
      setShowCustomA(false);
      updateStudyMetadata({ langA: code, labelsA: languageName(code) });
    } else {
      setShowCustomB(false);
      updateStudyMetadata({ langB: code, labelsB: languageName(code) });
    }
  };

  const updateCustomLanguage = (side: "a" | "b", rawValue: string) => {
    const normalized = normalizeLangCode(rawValue);
    if (side === "a") {
      setCustomLangA(rawValue);
      updateStudyMetadata({ langA: normalized, labelsA: getLangLabel(normalized) || rawValue.trim() });
    } else {
      setCustomLangB(rawValue);
      updateStudyMetadata({ langB: normalized, labelsB: getLangLabel(normalized) || rawValue.trim() });
    }
  };

  const swapLanguages = () => {
    updateStudyMetadata({
      langA: value.langB,
      langB: value.langA,
      labelsA: value.labelsB,
      labelsB: value.labelsA,
    });
    setCustomLangA(customLangB);
    setCustomLangB(customLangA);
    setShowCustomA(showCustomB);
    setShowCustomB(showCustomA);
  };

  const renderLanguageSelector = (side: "a" | "b") => {
    const custom = side === "a" ? customLangA : customLangB;
    const showCustom = side === "a" ? showCustomA : showCustomB;
    const language = side === "a" ? value.langA : value.langB;
    const resetLanguage = side === "a" ? "en" : "pt";

    if (showCustom) {
      return (
        <div className="flex gap-2">
          <Input
            value={custom}
            onChange={(event) => updateCustomLanguage(side, event.target.value)}
            placeholder={side === "a" ? "Ex: Japonês" : "Ex: Coreano"}
            className="h-10"
            disabled={isInherited}
          />
          <Button type="button" variant="ghost" size="sm" onClick={() => chooseLanguage(side, resetLanguage)} disabled={isInherited}>
            ✕
          </Button>
        </div>
      );
    }

    return (
      <Select value={language} onValueChange={(code) => chooseLanguage(side, code)} disabled={isInherited}>
        <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
        <SelectContent>
          {LANGUAGES.map((item) => (
            <SelectItem key={item.code} value={item.code}>{item.flag} {item.name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  return (
    <div className="space-y-4">
      {showPrimarySide && languageModeSupported !== false && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <Label className="font-medium">Configuração dos lados</Label>
            <p className="mt-1 text-xs text-muted-foreground">
              Define se os idiomas A/B pertencem a esta lista ou são herdados da pasta.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant={value.languageSettingsMode === "explicit" ? "default" : "outline"}
              onClick={() => update({ languageSettingsMode: "explicit" })}
              className="h-auto min-h-12 flex-col items-start gap-0.5 px-3 py-2 text-left"
            >
              <span>Usar configuração desta lista</span>
              <span className="text-[10px] font-normal opacity-80">A/B desta lista são a autoridade</span>
            </Button>
            <Button
              type="button"
              variant={value.languageSettingsMode === "inherited" ? "default" : "outline"}
              onClick={() => update({ languageSettingsMode: "inherited" })}
              className="h-auto min-h-12 flex-col items-start gap-0.5 px-3 py-2 text-left"
            >
              <span>Herdar configuração da pasta</span>
              <span className="text-[10px] font-normal opacity-80">A pasta passa a definir idiomas e labels</span>
            </Button>
          </div>
          {value.languageSettingsMode === "legacy" && (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-2.5 text-xs text-muted-foreground">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <span>
                Esta lista usa compatibilidade antiga. Escolha uma das opções acima e salve para eliminar a ambiguidade entre os idiomas da lista e da pasta.
              </span>
            </p>
          )}
        </div>
      )}

      {showPrimarySide && languageModeSupported === false && (
        <p className="rounded-md border bg-muted/30 p-3 text-xs text-muted-foreground">
          Esta instalação ainda usa o contrato legado de idiomas. Os campos A/B continuam editáveis e serão preservados sem reescrever os flashcards.
        </p>
      )}

      <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
        <Label className="font-medium">Tipo de Estudo</Label>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {Object.entries(STUDY_TYPE_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              type="button"
              variant={value.studyType === key ? "default" : "outline"}
              size="sm"
              onClick={() => handleStudyTypeChange(key)}
              className="flex items-center justify-start gap-2"
              disabled={isInherited}
            >
              {STUDY_TYPE_ICONS[key]}<span className="text-xs">{config.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {isInherited ? "Herdado da pasta. Troque para configuração própria para editar." : STUDY_TYPE_CONFIG[value.studyType]?.description}
        </p>
      </div>

      {showPrimarySide && (
        <div className="space-y-3 rounded-lg border bg-muted/30 p-4">
          <div>
            <Label className="font-medium">Lado principal da lista</Label>
            <p className="mt-1 text-xs text-muted-foreground">Define qual lado aparece primeiro nos jogos. Não altera o conteúdo dos cards.</p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(["a", "b"] as const).map((side) => {
              const label = side === "a" ? value.labelsA || "Lado A" : value.labelsB || "Lado B";
              return (
                <Button key={side} type="button" variant={primarySide === side ? "default" : "outline"} onClick={() => update({ primarySide: side })} className="h-auto min-h-12 flex-col gap-0.5">
                  <span>{label}</span>
                  <span className="text-[10px] opacity-80">Lado {side.toUpperCase()}{primarySide === side ? " • Principal" : ""}</span>
                </Button>
              );
            })}
          </div>
        </div>
      )}

      {isLanguageMode ? (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="grid grid-cols-[1fr,auto,1fr] items-end gap-3">
            <div className="space-y-2"><Label className="text-sm">Idioma do Lado A</Label>{renderLanguageSelector("a")}</div>
            <Button type="button" variant="ghost" size="icon" onClick={swapLanguages} title="Inverter A ↔ B" disabled={isInherited}><ArrowRightLeft className="h-4 w-4" /></Button>
            <div className="space-y-2"><Label className="text-sm">Idioma do Lado B</Label>{renderLanguageSelector("b")}</div>
          </div>
          <div className="flex items-center justify-between border-t pt-2">
            <div className="flex items-center gap-2">{value.ttsEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}<Label htmlFor="tts-toggle" className="cursor-pointer">Ativar áudio (TTS)</Label></div>
            <Switch id="tts-toggle" checked={value.ttsEnabled} onCheckedChange={(checked) => updateStudyMetadata({ ttsEnabled: checked })} disabled={isInherited} />
          </div>
          <div className="pt-2 text-xs text-muted-foreground">Lados: <strong>A · {value.labelsA || languageName(value.langA)}</strong>{" | "}<strong>B · {value.labelsB || languageName(value.langB)}</strong>{showPrimarySide && <span className="ml-2 font-semibold text-primary">Principal: {primarySide === "b" ? value.labelsB : value.labelsA}</span>}</div>
        </div>
      ) : (
        <div className="space-y-4 rounded-lg border bg-muted/30 p-4">
          <div className="flex items-center gap-2">{STUDY_TYPE_ICONS[value.studyType]}<Badge variant="secondary">{STUDY_TYPE_CONFIG[value.studyType]?.label}</Badge></div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className="space-y-2"><Label className="text-sm">Label do Lado A</Label><Input value={value.labelsA} onChange={(event) => updateStudyMetadata({ labelsA: event.target.value })} placeholder="Frente" className="h-10" disabled={isInherited} /></div>
            <div className="space-y-2"><Label className="text-sm">Label do Lado B</Label><Input value={value.labelsB} onChange={(event) => updateStudyMetadata({ labelsB: event.target.value })} placeholder="Verso" className="h-10" disabled={isInherited} /></div>
          </div>
          {hasTTS ? (
            <div className="flex items-center justify-between border-t pt-2">
              <div className="flex items-center gap-2">{value.ttsEnabled ? <Volume2 className="h-4 w-4 text-primary" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}<Label htmlFor="tts-toggle-general" className="cursor-pointer">Ativar áudio (TTS)</Label></div>
              <Switch id="tts-toggle-general" checked={value.ttsEnabled} onCheckedChange={(checked) => updateStudyMetadata({ ttsEnabled: checked })} disabled={isInherited} />
            </div>
          ) : <div className="flex items-center gap-2 border-t pt-2 text-sm text-muted-foreground"><VolumeX className="h-4 w-4" /> Este modo não suporta áudio.</div>}
        </div>
      )}
    </div>
  );
}

export function getDefaultListStudySettings(): ListStudySettings {
  return {
    studyType: "language",
    langA: "en",
    langB: "pt",
    labelsA: "English",
    labelsB: "Português",
    ttsEnabled: true,
    primarySide: "a",
    languageSettingsMode: "explicit",
  };
}

export function listRowToSettings(row: {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
  primary_side?: string | null;
  language_settings_mode?: string | null;
}): ListStudySettings {
  const studyType = (["language", "general", "math", "visual"].includes(row.study_type || "") ? row.study_type : "language") as ListStudySettings["studyType"];
  const langA = row.lang_a || "en";
  const langB = row.lang_b || "pt";
  return {
    studyType,
    langA,
    langB,
    labelsA: row.labels_a || (studyType === "language" ? languageName(langA) : STUDY_TYPE_CONFIG[studyType]?.defaultLabelA || "Frente"),
    labelsB: row.labels_b || (studyType === "language" ? languageName(langB) : STUDY_TYPE_CONFIG[studyType]?.defaultLabelB || "Verso"),
    ttsEnabled: row.tts_enabled ?? studyType === "language",
    primarySide: row.primary_side === "b" ? "b" : "a",
    languageSettingsMode: isLanguageSettingsMode(row.language_settings_mode)
      ? row.language_settings_mode
      : undefined,
  };
}

export function settingsToDbColumns(settings: ListStudySettings) {
  persistListPrimarySideFromCurrentRoute(settings.primarySide);
  const columns: Record<string, string | boolean> = {
    study_type: settings.studyType,
    lang_a: settings.langA,
    lang_b: settings.langB,
    labels_a: settings.labelsA,
    labels_b: settings.labelsB,
    tts_enabled: settings.ttsEnabled,
  };
  if (settings.languageSettingsMode === "explicit" || settings.languageSettingsMode === "inherited") {
    columns.language_settings_mode = settings.languageSettingsMode;
  }
  return columns;
}
