import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Languages, Loader2, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useFolderGlossarySummary } from "@/hooks/useFolderGlossary";
import { FolderGlossaryManager as FolderGlossaryManagerCore } from "@/features/study/components/FolderGlossaryManagerCore";
import { FolderGlossaryBulkDeleteCard } from "@/features/study/components/FolderGlossaryBulkDeleteCard";
import {
  CLASS_GLOSSARY_QUERY_KEY,
  ensureClassGlossaryStorageFolder,
  loadClassGlossaryLabels,
} from "@/features/classroom/lib/classGlossary";
import { ClassGlossaryAiPromptCard } from "./ClassGlossaryAiPromptCard";
import { ClassGlossaryCoverageCard } from "./ClassGlossaryCoverageCard";
import { ClassGlossarySemanticReviewCard } from "./ClassGlossarySemanticReviewCard";
import { ClassGlossarySyncCard } from "./ClassGlossarySyncCard";

interface Props {
  turmaId: string;
  turmaTitle: string;
}

function LoadedClassGlossary({
  turmaId,
  turmaTitle,
  storageFolderId,
  labelA,
  labelB,
}: Props & {
  storageFolderId: string;
  labelA: string;
  labelB: string;
}) {
  const { canEdit, total } = useFolderGlossarySummary(storageFolderId);

  return (
    <div className="space-y-4">
      <Card className="border-primary/25 bg-primary/[0.04]">
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-primary/10 p-2.5 text-primary">
              <Languages className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Glossário da turma</CardTitle>
              <CardDescription className="mt-1 max-w-3xl leading-relaxed">
                Esta caixa pertence somente a “{turmaTitle}”. Ela cobre as listas atribuídas à turma e não altera os glossários das pastas pessoais do professor.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex items-start gap-2 rounded-b-xl border-t bg-background/50 p-4 text-sm text-muted-foreground">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
          <p>
            O armazenamento usa o motor consolidado de glossário em um contêiner interno exclusivo da turma. Alunos podem consultar durante o estudo; somente o responsável pode editar.
          </p>
        </CardContent>
      </Card>

      {canEdit && (
        <>
          <ClassGlossaryAiPromptCard turmaTitle={turmaTitle} labelA={labelA} labelB={labelB} />
          <ClassGlossaryCoverageCard
            turmaId={turmaId}
            turmaTitle={turmaTitle}
            storageFolderId={storageFolderId}
            labelA={labelA}
            labelB={labelB}
          />
          <ClassGlossarySemanticReviewCard
            turmaId={turmaId}
            turmaTitle={turmaTitle}
            storageFolderId={storageFolderId}
            labelA={labelA}
            labelB={labelB}
          />
          <ClassGlossarySyncCard
            turmaId={turmaId}
            turmaTitle={turmaTitle}
            storageFolderId={storageFolderId}
          />
          <FolderGlossaryBulkDeleteCard
            folderId={storageFolderId}
            folderTitle={`Turma: ${turmaTitle}`}
            labelA={labelA}
            labelB={labelB}
            total={total}
          />
        </>
      )}

      <FolderGlossaryManagerCore
        folderId={storageFolderId}
        folderTitle={`Turma: ${turmaTitle}`}
        labelA={labelA}
        labelB={labelB}
      />
    </div>
  );
}

export function ClassGlossaryManager({ turmaId, turmaTitle }: Props) {
  const storageQuery = useQuery({
    queryKey: [...CLASS_GLOSSARY_QUERY_KEY, "storage", turmaId],
    queryFn: () => ensureClassGlossaryStorageFolder({ turmaId, turmaTitle }),
    enabled: Boolean(turmaId),
    staleTime: 5 * 60_000,
  });
  const labelsQuery = useQuery({
    queryKey: [...CLASS_GLOSSARY_QUERY_KEY, "labels", turmaId],
    queryFn: () => loadClassGlossaryLabels(turmaId),
    enabled: Boolean(turmaId),
    staleTime: 5 * 60_000,
  });

  if (storageQuery.isLoading) {
    return (
      <div className="mx-auto flex min-h-72 max-w-6xl flex-col items-center justify-center gap-3 px-4 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p>Preparando a caixa de glossário da turma...</p>
      </div>
    );
  }

  if (storageQuery.isError || !storageQuery.data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-12">
        <Card className="border-destructive/30 bg-destructive/5">
          <CardContent className="flex flex-col items-center gap-3 p-8 text-center">
            <AlertCircle className="h-8 w-8 text-destructive" />
            <CardTitle>Não foi possível abrir o glossário da turma</CardTitle>
            <p className="text-sm text-muted-foreground">
              {storageQuery.error instanceof Error ? storageQuery.error.message : "Tente novamente sem alterar os materiais da turma."}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-3 py-4 sm:px-4 sm:py-6 lg:px-8">
      <LoadedClassGlossary
        turmaId={turmaId}
        turmaTitle={turmaTitle}
        storageFolderId={storageQuery.data.id}
        labelA={labelsQuery.data?.labelA ?? "Lado A"}
        labelB={labelsQuery.data?.labelB ?? "Lado B"}
      />
    </div>
  );
}
