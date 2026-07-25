import { BookOpen, FolderTree, Layers3, ShieldCheck, UserRound } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";

type IconType = typeof BookOpen;
interface Model { title: string; description: string; items: string[]; icon: IconType }

function modelFor(pathname: string): Model | null {
  if (pathname.startsWith("/portal/professor/")) return {
    title: "Como interpretar este perfil público",
    description: "O perfil reúne informações profissionais e materiais que o professor escolheu publicar. Links externos podem comprovar autoria ou experiência, mas avaliações de aulas não são avaliações do APE.",
    items: [
      "Especialidades, abordagem e público atendido devem ser verificáveis.",
      "Pastas, listas e coleções aparecem apenas quando foram publicadas.",
      "Alunos, turmas privadas, progresso e agenda interna não fazem parte do perfil público.",
    ],
    icon: UserRound,
  };

  if (pathname.startsWith("/portal/folder/")) return {
    title: "Sobre esta pasta pública",
    description: "Uma pasta pública organiza listas relacionadas por tema, nível ou objetivo. Título, descrição, autoria e atualização ajudam o visitante a avaliar o conjunto.",
    items: [
      "Confira o público e o nível indicados pelo autor.",
      "Abra as listas para conhecer o conteúdo e os formatos de prática.",
      "A publicação desta pasta não expõe outras pastas pessoais do professor.",
    ],
    icon: FolderTree,
  };

  if (pathname.startsWith("/portal/list/")) return {
    title: "Como usar esta lista pública",
    description: "Uma lista pública deve deixar claro o que será praticado, os idiomas, a direção e os modos disponíveis. Exemplos visíveis ajudam a avaliar o material antes de iniciar.",
    items: [
      "Observe o tipo e a quantidade de cards apresentados.",
      "Escolha o modo conforme o objetivo: reconhecimento, escrita, ordenação, áudio ou revisão.",
      "Acertos imediatos não garantem retenção; volte ao conteúdo e aplique-o em outros contextos.",
    ],
    icon: BookOpen,
  };

  if (pathname.startsWith("/portal/collection/")) return {
    title: "Sobre esta coleção pública",
    description: "Uma coleção reúne materiais escolhidos por tema ou finalidade. Ordem sugerida, nível e pré-requisitos orientam o percurso sem prometer resultado.",
    items: [
      "Considere o critério usado para reunir os itens.",
      "Siga a ordem sugerida quando ela representar progressão de dificuldade.",
      "Consulte autoria e data de atualização antes de reutilizar o conjunto.",
    ],
    icon: Layers3,
  };

  return null;
}

export function DynamicPublicEditorialNote() {
  const { pathname } = useLocation();
  const model = modelFor(pathname);
  if (!model) return null;
  const Icon = model.icon;

  return (
    <section className="border-t border-border/60 bg-muted/15" aria-label="Contexto editorial do conteúdo público">
      <div className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
        <Card className="border-primary/20 bg-background/90">
          <CardContent className="p-5 sm:p-7">
            <div className="flex items-start gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-black sm:text-2xl">{model.title}</h2>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-muted-foreground sm:text-base">{model.description}</p>
                <ul className="mt-4 grid gap-3 md:grid-cols-3">
                  {model.items.map((item) => (
                    <li key={item} className="flex gap-2 rounded-xl border border-border/70 bg-muted/20 p-4 text-sm leading-6">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </section>
  );
}

export default DynamicPublicEditorialNote;
