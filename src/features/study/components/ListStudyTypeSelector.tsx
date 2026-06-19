import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRightLeft, Volume2, VolumeX, BookOpen, Calculator, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STUDY_TYPE_CONFIG, supportsTTS } from "@/features/study/lib/studyTypeConfig";
import { SUPPORTED_LANGUAGES, getLangLabel } from "@/features/study/lib/languages";

export interface ListStudySettings {
  studyType: "language" | "general" | "math" | "visual";
  langA: string;
  langB: string;
  labelsA: string;
  labelsB: string;
  ttsEnabled: boolean;
  primarySide: "a" | "b";
}

interface Props {
  value: ListStudySettings;
  onChange: (settings: ListStudySettings) => void;
}

const icons: Record<string, React.ReactNode> = {
  language: <Volume2 className="h-4 w-4" />,
  general: <BookOpen className="h-4 w-4" />,
  math: <Calculator className="h-4 w-4" />,
  visual: <Image className="h-4 w-4" />,
};

export function ListStudyTypeSelector({ value, onChange }: Props) {
  const language = value.studyType === "language";
  const changeType = (studyType: ListStudySettings["studyType"]) => {
    const config = STUDY_TYPE_CONFIG[studyType];
    onChange({
      ...value,
      studyType,
      ttsEnabled: studyType === "visual" ? false : value.ttsEnabled,
      labelsA: studyType === "language" ? getLangLabel(value.langA) : config.defaultLabelA,
      labelsB: studyType === "language" ? getLangLabel(value.langB) : config.defaultLabelB,
    });
  };
  const swapLanguages = () => onChange({
    ...value,
    langA: value.langB,
    langB: value.langA,
    labelsA: value.labelsB,
    labelsB: value.labelsA,
  });

  return <div className="space-y-4">
    <section className="p-4 border rounded-lg bg-muted/30 space-y-3">
      <Label>Tipo de Estudo</Label>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {Object.entries(STUDY_TYPE_CONFIG).map(([key, config]) => <Button
          key={key}
          type="button"
          size="sm"
          variant={value.studyType === key ? "default" : "outline"}
          onClick={() => changeType(key as ListStudySettings["studyType"])}
          className="justify-start gap-2"
        >{icons[key]}<span className="text-xs">{config.label}</span></Button>)}
      </div>
      <p className="text-xs text-muted-foreground">{STUDY_TYPE_CONFIG[value.studyType]?.description}</p>
    </section>

    <section className="p-4 border rounded-lg bg-muted/30 space-y-3">
      <div><Label>Lado principal da lista</Label><p className="text-xs text-muted-foreground">Define qual lado aparece primeiro nos jogos. Não altera o conteúdo dos cards.</p></div>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant={value.primarySide === "a" ? "default" : "outline"} onClick={() => onChange({ ...value, primarySide: "a" })}>{value.labelsA || "Lado A"}{value.primarySide === "a" ? " • Principal" : ""}</Button>
        <Button type="button" variant={value.primarySide === "b" ? "default" : "outline"} onClick={() => onChange({ ...value, primarySide: "b" })}>{value.labelsB || "Lado B"}{value.primarySide === "b" ? " • Principal" : ""}</Button>
      </div>
    </section>

    {language ? <section className="p-4 border rounded-lg bg-muted/30 space-y-4">
      <div className="grid grid-cols-[1fr,auto,1fr] gap-3 items-end">
        <div className="space-y-2"><Label>Idioma do Lado A</Label><Select value={value.langA} onValueChange={(langA) => onChange({ ...value, langA, labelsA: getLangLabel(langA) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPORTED_LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.flag} {item.label}</SelectItem>)}</SelectContent></Select></div>
        <Button type="button" variant="ghost" size="icon" onClick={swapLanguages}><ArrowRightLeft className="h-4 w-4" /></Button>
        <div className="space-y-2"><Label>Idioma do Lado B</Label><Select value={value.langB} onValueChange={(langB) => onChange({ ...value, langB, labelsB: getLangLabel(langB) })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{SUPPORTED_LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.flag} {item.label}</SelectItem>)}</SelectContent></Select></div>
      </div>
      <div className="flex items-center justify-between pt-2 border-t"><Label htmlFor="tts-toggle">Ativar áudio (TTS)</Label><Switch id="tts-toggle" checked={value.ttsEnabled} onCheckedChange={(ttsEnabled) => onChange({ ...value, ttsEnabled })} /></div>
      <p className="text-xs text-muted-foreground">Lados: A · <strong>{value.labelsA}</strong> &nbsp; B · <strong>{value.labelsB}</strong> &nbsp; <span className="text-primary font-semibold">Principal: {value.primarySide === "b" ? value.labelsB : value.labelsA}</span></p>
    </section> : <section className="p-4 border rounded-lg bg-muted/30 space-y-4">
      <Badge variant="secondary">{STUDY_TYPE_CONFIG[value.studyType]?.label}</Badge>
      <div className="grid md:grid-cols-2 gap-4"><div><Label>Label do Lado A</Label><Input value={value.labelsA} onChange={(event) => onChange({ ...value, labelsA: event.target.value })} /></div><div><Label>Label do Lado B</Label><Input value={value.labelsB} onChange={(event) => onChange({ ...value, labelsB: event.target.value })} /></div></div>
      {supportsTTS(value.studyType) ? <div className="flex items-center justify-between"><Label>Ativar áudio (TTS)</Label><Switch checked={value.ttsEnabled} onCheckedChange={(ttsEnabled) => onChange({ ...value, ttsEnabled })} /></div> : <p className="text-sm text-muted-foreground flex gap-2"><VolumeX className="h-4 w-4" />Este modo não suporta áudio.</p>}
    </section>}
  </div>;
}

export function getDefaultListStudySettings(): ListStudySettings {
  return { studyType: "language", langA: "en", langB: "pt", labelsA: "English", labelsB: "Português", ttsEnabled: true, primarySide: "a" };
}

export function listRowToSettings(row: { study_type?: string | null; lang_a?: string | null; lang_b?: string | null; labels_a?: string | null; labels_b?: string | null; tts_enabled?: boolean | null; primary_side?: string | null }): ListStudySettings {
  const studyType = (["language", "general", "math", "visual"].includes(row.study_type || "") ? row.study_type : "language") as ListStudySettings["studyType"];
  const langA = row.lang_a || "en", langB = row.lang_b || "pt";
  return { studyType, langA, langB, labelsA: row.labels_a || (studyType === "language" ? getLangLabel(langA) : "Frente"), labelsB: row.labels_b || (studyType === "language" ? getLangLabel(langB) : "Verso"), ttsEnabled: row.tts_enabled ?? languageDefault(studyType), primarySide: row.primary_side === "b" ? "b" : "a" };
}

const languageDefault = (studyType: string) => studyType === "language";

export function settingsToDbColumns(settings: ListStudySettings) {
  return { study_type: settings.studyType, lang_a: settings.langA, lang_b: settings.langB, labels_a: settings.labelsA, labels_b: settings.labelsB, tts_enabled: settings.ttsEnabled, primary_side: settings.primarySide };
}
