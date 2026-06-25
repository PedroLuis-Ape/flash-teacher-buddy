import { useEffect, useMemo, useState, type ComponentProps } from "react";
import { AlertTriangle, ExternalLink, Mic, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAudioRecorder } from "@/features/speech/useAudioRecorder";
import { PronunciationStudyView as NativePronunciationStudyView } from "./PronunciationStudyView.native";

const SPEECH_BETA_NOTICE =
  "Este recurso pode não funcionar corretamente em todos os navegadores. A correção é apenas uma estimativa e não deve ser tratada como nota definitiva de pronúncia.";

type PronunciationStudyViewProps = ComponentProps<typeof NativePronunciationStudyView>;

function isLikelyInAppBrowser(): boolean {
  if (typeof navigator === "undefined") return false;
  return /FBAN|FBAV|Instagram|Line\/|\bwv\b|; wv\)|TikTok|Snapchat|Twitter for/i.test(navigator.userAgent);
}

function SpeechBetaNotice() {
  return (
    <div
      role="note"
      className="flex w-full items-start gap-2 rounded-xl border border-amber-500/35 bg-amber-500/10 p-3 text-left text-xs text-amber-950 dark:text-amber-100 sm:text-sm"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
      <p>
        <strong className="mr-1 font-extrabold uppercase tracking-wide">BETA — avaliação orientativa.</strong>
        {SPEECH_BETA_NOTICE}
      </p>
    </div>
  );
}

export function PronunciationStudyView(props: PronunciationStudyViewProps) {
  const [permissionReady, setPermissionReady] = useState(false);
  const embeddedBrowser = useMemo(isLikelyInAppBrowser, []);
  const recorder = useAudioRecorder({ maxDurationMs: 1_000, minDurationMs: 0 });

  useEffect(() => {
    if (recorder.state !== "recording") return;
    setPermissionReady(true);
    recorder.cancel();
  }, [recorder.state, recorder.cancel]);

  useEffect(() => () => recorder.cancel(), [recorder.cancel]);

  if (!permissionReady) {
    const requesting = recorder.state === "requesting-permission";
    const blocked = recorder.state === "permission-denied";
    const unavailable = recorder.state === "unsupported";

    return (
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
        <SpeechBetaNotice />

        <Card className="flex min-h-[320px] flex-col items-center justify-center gap-4 border-2 p-5 text-center sm:p-8">
          <div className="flex h-16 w-16 items-center justify-center rounded-full border border-primary/25 bg-primary/10 text-primary">
            <Mic className="h-8 w-8" />
          </div>

          <div className="max-w-lg space-y-2">
            <h2 className="text-xl font-bold sm:text-2xl">Permitir áudio para começar</h2>
            <p className="text-sm text-muted-foreground sm:text-base">
              Ao tocar no botão abaixo, o App Piteco abrirá a solicitação oficial do navegador. A autorização continua sob seu controle.
            </p>
          </div>

          {embeddedBrowser && (
            <div className="flex max-w-lg items-start gap-2 rounded-lg border border-orange-500/30 bg-orange-500/10 p-3 text-left text-xs text-orange-950 dark:text-orange-100 sm:text-sm">
              <ExternalLink className="mt-0.5 h-4 w-4 shrink-0" />
              <p>Você parece estar usando um navegador interno. Para maior compatibilidade, abra esta página no Chrome, Edge ou Safari.</p>
            </div>
          )}

          {recorder.error && (
            <div className="max-w-lg rounded-lg border border-destructive/35 bg-destructive/10 p-3 text-sm text-destructive">
              {recorder.error}
              {blocked && (
                <p className="mt-2 text-xs">
                  Toque no ícone de cadeado ou de configurações ao lado do endereço do site e altere o acesso para Permitir.
                </p>
              )}
            </div>
          )}

          <div className="flex flex-wrap justify-center gap-2">
            <Button
              type="button"
              size="lg"
              className="min-h-12 gap-2"
              onClick={() => void recorder.start()}
              disabled={requesting || unavailable}
            >
              <ShieldCheck className="h-5 w-5" />
              {requesting ? "Aguardando autorização..." : blocked ? "Tentar novamente" : "Permitir áudio e começar"}
            </Button>

            {(unavailable || blocked) && (
              <Button type="button" variant="outline" size="lg" onClick={props.onNext}>
                Pular exercício
              </Button>
            )}
          </div>

          <p className="max-w-lg text-[11px] text-muted-foreground sm:text-xs">
            O acesso exige HTTPS. O fluxo usa recursos nativos do navegador e não adiciona API paga ao aplicativo.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <SpeechBetaNotice />
      <NativePronunciationStudyView {...props} />
    </div>
  );
}
