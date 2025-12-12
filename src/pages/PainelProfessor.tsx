import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { MeusAlunosCard } from "@/components/MeusAlunosCard";
import { MinhasTurmasCard } from "@/components/MinhasTurmasCard";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const PainelProfessor = () => {
  return (
    <div className="min-h-screen bg-background pb-24">
      <ApeAppBar title="Painel do Professor" />
      
      <div className="max-w-6xl mx-auto p-4 lg:px-8 space-y-8">
        <div className="space-y-2">
          <ApeSectionTitle>Gestão de Ensino</ApeSectionTitle>
          <p className="text-sm text-muted-foreground">
            Gerencie seus alunos, turmas e atribuições
          </p>
        </div>

        <div className="space-y-4">
          <MeusAlunosCard />
          <MinhasTurmasCard />
        </div>

        <div className="space-y-4">
          <ApeSectionTitle>Recursos</ApeSectionTitle>
          <Card className="hover:shadow-lg transition-all duration-200 cursor-pointer border-border">
            <CardContent className="p-5">
              <div className="flex items-center gap-4">
                <div className="shrink-0 w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <BookOpen className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">Criar Conteúdo</h3>
                  <p className="text-sm text-muted-foreground truncate">
                    Crie listas e pastas para seus alunos
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PainelProfessor;
