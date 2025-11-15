import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeSectionTitle } from "@/components/ape/ApeSectionTitle";
import { MeusAlunosCard } from "@/components/MeusAlunosCard";
import { MinhasTurmasCard } from "@/components/MinhasTurmasCard";
import { Card, CardContent } from "@/components/ui/card";
import { BookOpen } from "lucide-react";

const PainelProfessor = () => {
  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Painel do Professor" />
      
      <div className="p-4 space-y-6">
        <div>
          <ApeSectionTitle>Gestão de Ensino</ApeSectionTitle>
          <p className="text-sm text-muted-foreground mt-2">
            Gerencie seus alunos, turmas e atribuições
          </p>
        </div>

        <div className="space-y-4">
          <MeusAlunosCard />
          <MinhasTurmasCard />
        </div>

        <div>
          <ApeSectionTitle>Recursos</ApeSectionTitle>
          <div className="space-y-3 mt-3">
            <Card className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <div>
                    <h3 className="font-semibold text-sm">Criar Conteúdo</h3>
                    <p className="text-xs text-muted-foreground">
                      Crie listas e pastas para seus alunos
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PainelProfessor;
