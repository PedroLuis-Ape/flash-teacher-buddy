import { FormEvent, useMemo, useState } from "react";
import { AlertCircle, Bug, CheckCircle2, Send } from "lucide-react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useAuthUser } from "@/hooks/useAuthUser";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type ReportCategory = "bug" | "content" | "access" | "performance" | "suggestion" | "other";
type ReportSeverity = "low" | "normal" | "high" | "critical";

type SubmitState = "idle" | "submitting" | "success" | "error";

const categories: Array<{ value: ReportCategory; label: string; helper: string }> = [
  { value: "bug", label: "Erro no app", helper: "Tela quebrada, botão falhando ou comportamento estranho." },
  { value: "content", label: "Conteúdo", helper: "Card, tradução, áudio ou atividade com problema." },
  { value: "access", label: "Acesso", helper: "Login, turma, aluno, professor ou permissão." },
  { value: "performance", label: "Lentidão", helper: "Travamento, carregamento pesado ou tela engasgando." },
  { value: "suggestion", label: "Sugestão", helper: "Melhoria simples para deixar o app mais claro." },
  { value: "other", label: "Outro", helper: "Algo importante que não encaixa nas opções acima." },
];

const severities: Array<{ value: ReportSeverity; label: string }> = [
  { value: "low", label: "Baixa" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "Alta" },
  { value: "critical", label: "Crítica" },
];

const initialForm = {
  category: "bug" as ReportCategory,
  severity: "normal" as ReportSeverity,
  title: "",
  description: "",
};

function getCurrentPageUrl() {
  if (typeof window === "undefined") return null;
  return `${window.location.pathname}${window.location.search}${window.location.hash}`;
}

export default function BugReportPage() {
  const { user } = useAuthUser();
  const [form, setForm] = useState(initialForm);
  const [state, setState] = useState<SubmitState>("idle");

  const selectedCategory = useMemo(
    () => categories.find((category) => category.value === form.category) ?? categories[0],
    [form.category],
  );

  const titleLength = form.title.trim().length;
  const descriptionLength = form.description.trim().length;
  const canSubmit = Boolean(user) && titleLength >= 3 && descriptionLength >= 10 && state !== "submitting";

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      toast.error("Entre na sua conta para enviar um reporte.");
      return;
    }

    if (!canSubmit) {
      toast.error("Preencha o título e descreva o problema com um pouco mais de detalhe.");
      return;
    }

    try {
      setState("submitting");

      const payload = {
        user_id: user.id,
        category: form.category,
        severity: form.severity,
        title: form.title.trim(),
        description: form.description.trim(),
        page_url: getCurrentPageUrl(),
        user_agent: typeof navigator === "undefined" ? null : navigator.userAgent,
        metadata: {
          app: "App Piteco",
          viewport:
            typeof window === "undefined"
              ? null
              : { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
          language: typeof navigator === "undefined" ? null : navigator.language,
        },
      };

      const { error } = await (supabase as any).from("bug_reports").insert(payload);
      if (error) throw error;

      setState("success");
      setForm(initialForm);
      toast.success("Reporte enviado. Valeu por ajudar a deixar o App Piteco mais redondo.");
    } catch (error) {
      console.error("[BugReport] submit failed", error);
      setState("error");
      toast.error("Não consegui enviar agora. Tente novamente em alguns instantes.");
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Reportar problema" showBack backPath="/dashboard" />

      <main className="mx-auto flex w-full max-w-2xl flex-col gap-4 p-4 pb-32 sm:gap-5 sm:p-6">
        <Card>
          <CardHeader className="space-y-2">
            <div className="flex items-start gap-3">
              <div className="rounded-2xl border bg-muted/40 p-3">
                <Bug className="h-5 w-5 text-primary" aria-hidden="true" />
              </div>
              <div className="min-w-0 flex-1">
                <CardTitle>Conte o que aconteceu</CardTitle>
                <CardDescription className="mt-1 leading-relaxed">
                  Use este canal para erro real, conteúdo errado, problema de acesso ou lentidão. Nada de pop-up pulando na tela: aqui o reporte mora dentro do menu, como gente civilizada.
                </CardDescription>
              </div>
            </div>
          </CardHeader>
        </Card>

        {state === "success" && (
          <Alert className="border-primary/30 bg-primary/5">
            <CheckCircle2 className="h-4 w-4" />
            <AlertTitle>Reporte recebido</AlertTitle>
            <AlertDescription>
              Seu envio foi salvo com segurança. A página atual e dados básicos do navegador foram anexados para facilitar a correção.
            </AlertDescription>
          </Alert>
        )}

        {state === "error" && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Envio não concluído</AlertTitle>
            <AlertDescription>
              O formulário continua disponível. Revise a conexão e tente enviar novamente.
            </AlertDescription>
          </Alert>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Novo reporte</CardTitle>
            <CardDescription>Campos curtos, direto ao ponto. Quanto mais contexto, menos caça-fantasma no código.</CardDescription>
          </CardHeader>
          <CardContent>
            <form className="space-y-5" onSubmit={submit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="report-category">Tipo</Label>
                  <Select
                    value={form.category}
                    onValueChange={(value) => setForm((current) => ({ ...current, category: value as ReportCategory }))}
                  >
                    <SelectTrigger id="report-category">
                      <SelectValue placeholder="Escolha o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((category) => (
                        <SelectItem key={category.value} value={category.value}>{category.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">{selectedCategory.helper}</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="report-severity">Urgência</Label>
                  <Select
                    value={form.severity}
                    onValueChange={(value) => setForm((current) => ({ ...current, severity: value as ReportSeverity }))}
                  >
                    <SelectTrigger id="report-severity">
                      <SelectValue placeholder="Escolha a urgência" />
                    </SelectTrigger>
                    <SelectContent>
                      {severities.map((severity) => (
                        <SelectItem key={severity.value} value={severity.value}>{severity.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="report-title">Título</Label>
                  <span className="text-xs text-muted-foreground">{titleLength}/140</span>
                </div>
                <Input
                  id="report-title"
                  maxLength={140}
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Ex.: Botão continuar fica instável no mobile"
                  autoComplete="off"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Label htmlFor="report-description">Descrição</Label>
                  <span className="text-xs text-muted-foreground">{descriptionLength}/4000</span>
                </div>
                <Textarea
                  id="report-description"
                  maxLength={4000}
                  value={form.description}
                  onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Diga o que você tentou fazer, o que aconteceu e o que esperava que acontecesse. Se for no celular, diga também o modelo ou navegador quando souber."
                  className="min-h-36 resize-y"
                />
              </div>

              <div className="rounded-xl border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
                Enviaremos junto: rota atual, navegador, idioma e tamanho da tela. Não envie senha, chave de API ou dados sensíveis no texto.
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setForm(initialForm)}
                  disabled={state === "submitting"}
                >
                  Limpar
                </Button>
                <Button type="submit" disabled={!canSubmit} className="gap-2">
                  <Send className="h-4 w-4" />
                  {state === "submitting" ? "Enviando..." : "Enviar reporte"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
