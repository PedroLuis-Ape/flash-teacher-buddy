import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Upload, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";

export default function KingdomImport() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
    }
  };

  const handleImport = async () => {
    if (!file) {
      toast.error("Selecione um arquivo CSV");
      return;
    }

    setImporting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Você precisa estar logado");
        navigate("/auth");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/kingdoms-import-csv`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        if (result.details) {
          toast.error(
            <div>
              <div className="font-semibold mb-2">{result.error}</div>
              <div className="text-sm space-y-1">
                {result.details.slice(0, 5).map((err: string, idx: number) => (
                  <div key={idx}>{err}</div>
                ))}
                {result.details.length > 5 && (
                  <div>... e mais {result.details.length - 5} erros</div>
                )}
              </div>
            </div>,
            { duration: 10000 }
          );
        } else {
          toast.error(result.error || "Erro ao importar CSV");
        }
        return;
      }

      toast.success(
        <div>
          <div className="font-semibold">Importação concluída!</div>
          <div className="text-sm">
            {result.inserted} atividades inseridas/atualizadas
            {result.failed > 0 && `, ${result.failed} falharam`}
          </div>
        </div>
      );

      setFile(null);
      navigate("/reino");
    } catch (error) {
      console.error("Import error:", error);
      toast.error("Erro ao importar CSV");
    } finally {
      setImporting(false);
    }
  };

  const downloadTemplate = () => {
    const template = `kingdom_code,level_code,unit,activity_type,prompt,answer,choices,lang,points,tags
K1,L1,Greetings,translate,Hello (cumprimento padrão),Hello,[Hi | Hello there],en-US,,
K1,L1,Be-verb,multiple_choice,I ___ Pedro,[I am | I'm],*I am||I is||I'm not,en-US,,
K1,L1,Feelings,translate,I am happy (estado emocional),I am happy,[I'm happy],en-US,,`;

    const blob = new Blob([template], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_kingdom.csv";
    link.click();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 p-4 pb-24">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Button variant="ghost" size="icon" onClick={() => navigate("/reino")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Importar Atividades</h1>
            <p className="text-muted-foreground">
              Upload de CSV para o Modo Reino
            </p>
          </div>
        </div>

        {/* Template Download */}
        <Card className="p-6 mb-6">
          <div className="flex items-start gap-4">
            <FileText className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Template CSV</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Baixe o template com exemplos para preencher suas atividades.
                O arquivo deve estar em UTF-8.
              </p>
              <Button variant="outline" size="sm" onClick={downloadTemplate}>
                <Download className="mr-2 h-4 w-4" />
                Baixar Template
              </Button>
            </div>
          </div>
        </Card>

        {/* Upload */}
        <Card className="p-6">
          <div className="flex items-start gap-4">
            <Upload className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
            <div className="flex-1">
              <h2 className="text-lg font-semibold mb-2">Upload CSV</h2>
              <p className="text-sm text-muted-foreground mb-4">
                Selecione o arquivo CSV preenchido para importar as atividades.
              </p>

              <div className="space-y-4">
                <Input
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  disabled={importing}
                />

                {file && (
                  <div className="text-sm text-muted-foreground">
                    Arquivo selecionado: {file.name}
                  </div>
                )}

                <Button
                  onClick={handleImport}
                  disabled={!file || importing}
                  className="w-full"
                >
                  {importing ? "Importando..." : "Importar Atividades"}
                </Button>
              </div>
            </div>
          </div>
        </Card>

        {/* Instructions */}
        <Card className="p-6 mt-6 bg-muted/50">
          <h3 className="font-semibold mb-3">Formato do CSV</h3>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              <strong>() = Hint:</strong> Texto entre parênteses vira dica e não conta na correção
            </p>
            <p>
              <strong>[] com |:</strong> Respostas alternativas aceitas (ex: [Hi | Hello])
            </p>
            <p>
              <strong>* em choices:</strong> Marca a resposta correta em múltipla escolha
            </p>
            <p>
              <strong>Tipos válidos:</strong> translate, multiple_choice, dictation, fill_blank, order_words, match
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
}
