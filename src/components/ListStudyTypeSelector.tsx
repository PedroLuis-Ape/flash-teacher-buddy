import { useState, useEffect } from "react";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Volume2, VolumeX, Beaker } from "lucide-react";
import { Badge } from "@/components/ui/badge";

// Common language options
const LANGUAGES = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "pt", name: "Português", flag: "🇧🇷" },
  { code: "es", name: "Español", flag: "🇪🇸" },
  { code: "fr", name: "Français", flag: "🇫🇷" },
  { code: "de", name: "Deutsch", flag: "🇩🇪" },
  { code: "it", name: "Italiano", flag: "🇮🇹" },
  { code: "ja", name: "日本語", flag: "🇯🇵" },
  { code: "zh", name: "中文", flag: "🇨🇳" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "ru", name: "Русский", flag: "🇷🇺" },
  { code: "ar", name: "العربية", flag: "🇸🇦" },
  { code: "hi", name: "हिन्दी", flag: "🇮🇳" },
  { code: "other", name: "Outro...", flag: "🌍" },
];

export interface ListStudySettings {
  studyType: "language" | "general";
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
}

interface ListStudyTypeSelectorProps {
  value: ListStudySettings;
  onChange: (settings: ListStudySettings) => void;
}

function getLanguageName(code: string): string {
  const lang = LANGUAGES.find(l => l.code === code);
  return lang?.name || code.toUpperCase();
}

export function ListStudyTypeSelector({ value, onChange }: ListStudyTypeSelectorProps) {
  const [customLangA, setCustomLangA] = useState("");
  const [customLangB, setCustomLangB] = useState("");
  const [showCustomA, setShowCustomA] = useState(false);
  const [showCustomB, setShowCustomB] = useState(false);

  // Check if current langs are custom (not in predefined list)
  useEffect(() => {
    if (value.langA && !LANGUAGES.find(l => l.code === value.langA)) {
      setCustomLangA(value.langA);
      setShowCustomA(true);
    }
    if (value.langB && !LANGUAGES.find(l => l.code === value.langB)) {
      setCustomLangB(value.langB);
      setShowCustomB(true);
    }
  }, []);

  const handleStudyTypeChange = (type: "language" | "general") => {
    onChange({
      ...value,
      studyType: type,
      ttsEnabled: type === "language",
      labelsA: type === "general" ? "Frente" : "",
      labelsB: type === "general" ? "Verso" : "",
    });
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
    onChange({
      ...value,
      langA: customCode.toLowerCase().trim(),
      labelsA: customCode.trim(),
    });
  };

  const handleCustomLangB = (customCode: string) => {
    setCustomLangB(customCode);
    onChange({
      ...value,
      langB: customCode.toLowerCase().trim(),
      labelsB: customCode.trim(),
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
    // Also swap custom inputs
    const tempCustom = customLangA;
    setCustomLangA(customLangB);
    setCustomLangB(tempCustom);
    const tempShow = showCustomA;
    setShowCustomA(showCustomB);
    setShowCustomB(tempShow);
  };

  return (
    <div className="space-y-6">
      {/* Study Type Selection */}
      <div className="space-y-3">
        <Label className="text-base font-semibold">Tipo de Estudo</Label>
        <RadioGroup
          value={value.studyType}
          onValueChange={(v) => handleStudyTypeChange(v as "language" | "general")}
          className="grid grid-cols-1 sm:grid-cols-2 gap-3"
        >
          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="language" id="language" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="language" className="font-medium cursor-pointer flex items-center gap-2">
                <Volume2 className="h-4 w-4 text-primary" />
                Idiomas
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Para aprender vocabulário e frases. Inclui áudio (TTS).
              </p>
            </div>
          </div>
          <div className="flex items-start space-x-3 border rounded-lg p-4 cursor-pointer hover:bg-accent/50 transition-colors">
            <RadioGroupItem value="general" id="general" className="mt-1" />
            <div className="flex-1">
              <Label htmlFor="general" className="font-medium cursor-pointer flex items-center gap-2">
                <Beaker className="h-4 w-4 text-muted-foreground" />
                Estudo Geral
                <Badge variant="secondary" className="text-xs">Beta</Badge>
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Ciências, matemática, etc. Sem áudio por enquanto.
              </p>
            </div>
          </div>
        </RadioGroup>
      </div>

      {/* Language Mode Options */}
      {value.studyType === "language" && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-end">
            {/* Language A */}
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

            {/* Swap Button */}
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

            {/* Language B */}
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

          {/* TTS Toggle */}
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

          {/* Preview Labels */}
          <div className="text-xs text-muted-foreground pt-2">
            Preview: <strong>{value.labelsA || getLanguageName(value.langA)}</strong> → <strong>{value.labelsB || getLanguageName(value.langB)}</strong>
          </div>
        </div>
      )}

      {/* General Mode Options */}
      {value.studyType === "general" && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-2 gap-4">
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
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground pt-2 border-t">
            <VolumeX className="h-4 w-4" />
            Modo Estudo Geral não tem áudio por enquanto.
          </div>
        </div>
      )}
    </div>
  );
}

// Helper to get default settings
export function getDefaultListStudySettings(): ListStudySettings {
  return {
    studyType: "language",
    langA: "en",
    langB: "pt",
    labelsA: "English",
    labelsB: "Português",
    ttsEnabled: true,
  };
}

// Helper to map from DB row to settings
export function listRowToSettings(row: {
  study_type?: string | null;
  lang_a?: string | null;
  lang_b?: string | null;
  labels_a?: string | null;
  labels_b?: string | null;
  tts_enabled?: boolean | null;
}): ListStudySettings {
  const studyType = (row.study_type === "general" ? "general" : "language") as "language" | "general";
  const langA = row.lang_a || "en";
  const langB = row.lang_b || "pt";
  
  return {
    studyType,
    langA,
    langB,
    labelsA: row.labels_a || (studyType === "general" ? "Frente" : getLanguageName(langA)),
    labelsB: row.labels_b || (studyType === "general" ? "Verso" : getLanguageName(langB)),
    ttsEnabled: row.tts_enabled ?? (studyType === "language"),
  };
}

// Helper to map settings to DB columns
export function settingsToDbColumns(settings: ListStudySettings) {
  return {
    study_type: settings.studyType,
    lang_a: settings.langA,
    lang_b: settings.langB,
    labels_a: settings.labelsA,
    labels_b: settings.labelsB,
    tts_enabled: settings.ttsEnabled,
  };
}
