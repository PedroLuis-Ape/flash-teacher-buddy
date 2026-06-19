import { useState, useEffect, useRef } from "react";
import { useParams } from "react-router-dom";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Volume2, VolumeX, BookOpen, Calculator, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STUDY_TYPE_CONFIG, supportsTTS } from "@/features/study/lib/studyTypeConfig";
import {
  SUPPORTED_LANGUAGES,
  getLangLabel,
  normalizeLangCode,
} from "@/features/study/lib/languages";
import { useListPrimarySide } from "@/lib/useListPrimarySide";

const LANGUAGES = [
  ...SUPPORTED_LANGUAGES.map((l) => ({ code: l.code, name: l.label, flag: l.flag })),
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
}

interface ListStudyTypeSelectorProps {
  value: ListStudySettings;
  onChange: (settings: ListStudySettings) => void;
}

function getLanguageName(code: string): string {
  return getLangLabel(code);
}

const STUDY_TYPE_ICONS: Record<string, React.ReactNode> = {
  language: <Volume2 className="h-4 w-4" />,
  general: <BookOpen className="h-4 w-4" />,
  math: <Calculator className="h-4 w-4" />,
  visual: <Image className="h-4 w-4" />,
};

export function ListStudyTypeSelector({ value, onChange }: ListStudyTypeSelectorProps) {
  const { id } = useParams();
  const showPrimarySide = window.location.pathname.startsWith("/list/");
  const { side: savedPrimarySide, loading: primarySideLoading } = useListPrimarySide(showPrimarySide ? id || null : null);
  const primaryHydratedRef = useRef(false);
  const [customLangA, setCustomLangA] = useState("");
  const [customLangB, setCustomLangB] = useState("");
  const [showCustomA, setShowCustomA] = useState(false);
  const [showCustomB, setShowCustomB] = useState(false);

  useEffect(() => {
    if (value.langA && !LANGUAGES.find(l => l.code === value.langA)) {
      setCustomLangA(value.langA);
      setShowCustomA(true);
    }
    if (value.langB && !LANGUAGES.find(l => l.code === value.langB)) {
      setCustomLangB(value.langB);
      setShowCustomB(true);
    }
  }, [value.langA, value.langB]);

  useEffect(() => {
    primaryHydratedRef.current = false;
  }, [id]);

  useEffect(() => {
    if (!showPrimarySide || primarySideLoading || primaryHydratedRef.current) return;
    primaryHydratedRef.current = true;
    if ((value.primarySide === "b" ? "b" : "a") !== savedPrimarySide) {
      onChange({ ...value, primarySide: savedPrimarySide });
    }
  }, [onChange, primarySideLoading, savedPrimarySide, showPrimarySide, value]);

  const primarySide = value.primarySide === "b" ? "b" : "a";
  const isLanguageMode = value.studyType === "language";
  const hasTTS = supportsTTS(value.studyType);

  const handleStudyTypeChange = (newType: string) => {
    const config = STUDY_TYPE_CONFIG[newType];
    if (!config) return;

    if (newType === "language") {
      onChange({
        ...value,
        studyType: "language",
        ttsEnabled: true,
        labelsA: getLanguageName(value.langA || "en"),
        labelsB: getLanguageName(value.langB || "pt"),
      });
    } else {
      onChange({
        ...value,
        studyType: newType as ListStudySettings["studyType"],
        ttsEnabled: newType === "visual" ? false : value.ttsEnabled,
        labelsA: config.defaultLabelA,
        labelsB: config.defaultLabelB,
      });
    }
  };

  const handleLangAChange = (code: string) => {
    if (code === "other") {
      setShowCustomA(true);
      return;
    }
    setShowCustomA(false);
    onChange({
      ...value,
      langA: code,
      labelsA: getLanguageName(code),
    });
  };

  const handleLangBChange = (code: string) => {
    if (code === "other") {
      setShowCustomB(true);
      return;
    }
    setShowCustomB(false);
    onChange({
      ...value,
      langB: code,
      labelsB: getLanguageName(code),
    });
  };

  const handleCustomLangA = (customCode: string) => {
    setCustomLangA(customCode);
    const normalized = normalizeLangCode(customCode);
    onChange({
      ...value,
      langA: normalized,
      labelsA: getLangLabel(normalized) || customCode.trim(),
    });
  };

  const handleCustomLangB = (customCode: string) => {
    setCustomLangB(customCode);
    const normalized = normalizeLangCode(customCode);
    onChange({
      ...value,
      langB: normalized,
      labelsB: getLangLabel(normalized) || customCode.trim(),
    });
  };

  const handleSwapLanguages = () => {
    onChange({
      ...value,
      langA: value.langB,
      langB: value.langA,
      labelsA: value.labelsB,
      labelsB: value.labelsA,
    });
    const tempCustom = customLangA;
    setCustomLangA(customLangB);
    setCustomLangB(tempCustom);
    const tempShow = showCustomA;
    setShowCustomA(showCustomB);
    setShowCustomB(tempShow);
  };

  return (
    <div className="space-y-4">
      <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
        <Label className="font-medium">Tipo de Estudo</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(STUDY_TYPE_CONFIG).map(([key, config]) => (
            <Button
              key={key}
              type="button"
              variant={value.studyType === key ? "default" : "outline"}
              size="sm"
              onClick={() => handleStudyTypeChange(key)}
              className="flex items-center gap-2 justify-start"
            >
              {STUDY_TYPE_ICONS[key]}
              <span className="text-xs">{config.label}</span>
            </Button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {STUDY_TYPE_CONFIG[value.studyType]?.description}
        </p>
      </div>

      {showPrimarySide && (
        <div className="p-4 border rounded-lg bg-muted/30 space-y-3">
          <div>
            <Label className="font-medium">Lado principal da lista</Label>
            <p className="text-xs text-muted-foreground mt-1">
              Define qual lado aparece primeiro nos jogos. Não altera o conteúdo dos cards.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant={primarySide === "a" ? "default" : "outline"}
              onClick={() => onChange({ ...value, primarySide: "a" })}
              className="h-auto min-h-12 flex-col gap-0.5"
            >
              <span>{value.labelsA || "Lado A"}</span>
              <span className="text-[10px] opacity-80">Lado A{primarySide === "a" ? " • Principal" : ""}</span>
            </Button>
            <Button
              type="button"
              variant={primarySide === "b" ? "default" : "outline"}
              onClick={() => onChange({ ...value, primarySide: "b" })}
              className="h-auto min-h-12 flex-col gap-0.5"
            >
              <span>{value.labelsB || "Lado B"}</span>
              <span className="text-[10px] opacity-80">Lado B{primarySide === "b" ? " • Principal" : ""}</span>
            </Button>
          </div>
        </div>
      )}

      {isLanguageMode && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-end">
            <div className="space-y-2">
              <Label className="text-sm">Idioma do Lado A</Label>
              {showCustomA ? (
                <div className="flex gap-2">
                  <Input
                    value={customLangA}
                    onChange={(e) => handleCustomLangA(e.target.value)}
                    placeholder="Ex: Japonês"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCustomA(false);
                      handleLangAChange("en");
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select value={value.langA} onValueChange={handleLangAChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleSwapLanguages}
              className="mb-0.5"
              title="Inverter A ↔ B"
            >
              <ArrowRightLeft className="h-4 w-4" />
            </Button>

            <div className="space-y-2">
              <Label className="text-sm">Idioma do Lado B</Label>
              {showCustomB ? (
                <div className="flex gap-2">
                  <Input
                    value={customLangB}
                    onChange={(e) => handleCustomLangB(e.target.value)}
                    placeholder="Ex: Coreano"
                    className="h-10"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setShowCustomB(false);
                      handleLangBChange("pt");
                    }}
                  >
                    ✕
                  </Button>
                </div>
              ) : (
                <Select value={value.langB} onValueChange={handleLangBChange}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {LANGUAGES.map((lang) => (
                      <SelectItem key={lang.code} value={lang.code}>
                        {lang.flag} {lang.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between pt-2 border-t">
            <div className="flex items-center gap-2">
              {value.ttsEnabled ? (
                <Volume2 className="h-4 w-4 text-primary" />
              ) : (
                <VolumeX className="h-4 w-4 text-muted-foreground" />
              )}
              <Label htmlFor="tts-toggle" className="cursor-pointer">
                Ativar áudio (TTS)
              </Label>
            </div>
            <Switch
              id="tts-toggle"
              checked={value.ttsEnabled}
              onCheckedChange={(checked) => onChange({ ...value, ttsEnabled: checked })}
            />
          </div>

          <div className="text-xs text-muted-foreground pt-2">
            Lados: <strong>A · {value.labelsA || getLanguageName(value.langA)}</strong>
            {" | "}
            <strong>B · {value.labelsB || getLanguageName(value.langB)}</strong>
            {showPrimarySide && (
              <span className="ml-2 text-primary font-semibold">
                Principal: {primarySide === "b" ? value.labelsB : value.labelsA}
              </span>
            )}
          </div>
        </div>
      )}

      {!isLanguageMode && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg border">
          <div className="flex items-center gap-2">
            {STUDY_TYPE_ICONS[value.studyType]}
            <Badge variant="secondary">{STUDY_TYPE_CONFIG[value.studyType]?.label}</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label className="text-sm">Label do Lado A</Label>
              <Input
                value={value.labelsA}
                onChange={(e) => onChange({ ...value, labelsA: e.target.value })}
                placeholder="Frente"
                className="h-10"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm">Label do Lado B</Label>
              <Input
                value={value.labelsB}
                onChange={(e) => onChange({ ...value, labelsB: e.target.value })}
                placeholder="Verso"
                className="h-10"
              />
            </div>
          </div>

          {hasTTS && (
            <div className="flex items-center justify-between pt-2 border-t">
              <div className="flex items-center gap-2">
                {value.ttsEnabled ? (
                  <Volume2 className="h-4 w-4 text-primary" />
                ) : (
                  <VolumeX className="h-4 w-4 text-muted-foreground" />
                )}
                <Label htmlFor="tts-toggle-general" className="cursor-pointer">
                  Ativar áudio (TTS)
                </Label>
              </div>
              <Switch
                id="tts-toggle-general"
                checked={value.ttsEnabled}
                onCheckedChange={(checked) => onChange({ ...value, ttsEnabled: checked })}
              />
            </div>
          )}

          {!hasTTS && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
              <VolumeX className="h-4 w-4" />
              Este modo não suporta áudio.
            </div>
          )}
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
}): ListStudySettings {
  const studyType = (["language", "general", "math", "visual"].includes(row.study_type || "")
    ? row.study_type
    : "language") as ListStudySettings["studyType"];
  const langA = row.lang_a || "en";
  const langB = row.lang_b || "pt";

  return {
    studyType,
    langA,
    langB,
    labelsA: row.labels_a || (studyType === "language" ? getLanguageName(langA) : STUDY_TYPE_CONFIG[studyType]?.defaultLabelA || "Frente"),
    labelsB: row.labels_b || (studyType === "language" ? getLanguageName(langB) : STUDY_TYPE_CONFIG[studyType]?.defaultLabelB || "Verso"),
    ttsEnabled: row.tts_enabled ?? (studyType === "language"),
    primarySide: row.primary_side === "b" ? "b" : "a",
  };
}

export function settingsToDbColumns(settings: ListStudySettings) {
  return {
    study_type: settings.studyType,
    lang_a: settings.langA,
    lang_b: settings.langB,
    labels_a: settings.labelsA,
    labels_b: settings.labelsB,
    tts_enabled: settings.ttsEnabled,
    primary_side: settings.primarySide === "b" ? "b" : "a",
  };
}
