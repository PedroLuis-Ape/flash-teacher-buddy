import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, Play, RefreshCcw, Trash2 } from "lucide-react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useInstitution } from "@/contexts/InstitutionContext";
import { useReinforcement, useReinforcementMutation } from "@/hooks/useReinforcement";

export default function Reinforcement() {
  const navigate = useNavigate();
  const { user, userId, isLoading: authLoading } = useAuthUser();
  const { selectedInstitution } = useInstitution();
  const institutionId = selectedInstitution?.id ?? null;
  const reinforcement = useReinforcement(userId, institutionId);
  const mutation = useReinforcementMutation(userId, institutionId);
  const snapshot = reinforcement.data;
  const area = snapshot?.area;
  const items = snapshot?.items ?? [];

  useEffect(() => {
    if (!authLoading && !user) navigate("/auth", { replace: true });
  }, [authLoading, navigate, user]);

  if (!authLoading && !user) return null;

  return (
    <div className="min-h-screen bg-background pb-24">
      <ApeAppBar title="Reforço" variant="home" />
      <main className="mx-auto max-w-3xl space-y-5 px-4 py-5 lg:px-8">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="flex items-start gap-4 p-5">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <RefreshCcw className="h-6 w-6" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-lg font-semibold">REVISÃO PESSOAL</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Cards completos que você escolheu praticar novamente
                {selectedInstitution ? ` em ${selectedInstitution.name}` : ""}.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Esta coleção é automática e somente leitura. Você pode estudar ou remover itens.
              </p>
            </div>
            {area && items.length > 0 && (
              <Button
                className="min-h-11 shrink-0"
                onClick={() => navigate(`/list/${area.list_id}/study?reinforcement=true`)}
              >
                <Play className="mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Estudar agora</span>
                <span className="sm:hidden">Estudar</span>
              </Button>
            )}
          </CardContent>
        </Card>

        {reinforcement.isPending && !snapshot ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : items.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center gap-3 p-10 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/50" />
              <div>
                <h2 className="font-semibold">Seu Reforço está vazio</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Durante o estudo, use “Adicionar ao Reforço” no card inteiro.
                </p>
              </div>
              <Button variant="outline" className="min-h-11" onClick={() => navigate("/folders")}>
                Abrir biblioteca
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <Card key={item.id}>
                <CardContent className="flex items-center gap-3 p-4 sm:p-5">
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate font-semibold">{item.term}</h2>
                    <p className="truncate text-sm text-muted-foreground">{item.translation}</p>
                    {item.layer_count > 1 && (
                      <p className="mt-1 text-xs text-muted-foreground">{item.layer_count} camadas</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    className="min-h-11 min-w-11 shrink-0 text-destructive hover:text-destructive"
                    disabled={mutation.isPending}
                    title="Remover dos pontos de reforço"
                    aria-label={`Remover ${item.term} do Reforço`}
                    onClick={() => mutation.mutate({
                      sourceCardId: item.source_card_id,
                      sourceGroupId: item.source_group_uid,
                      enabled: false,
                      institutionId,
                    })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
