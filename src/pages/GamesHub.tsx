import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, RotateCcw, Pencil, Layers3 } from "lucide-react";
import { toast } from "sonner";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface List {
  id: string;
  title: string;
  description?: string;
}

const GamesHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [direction, setDirection] = useState<"pt-en" | "en-pt" | "any">("any");
  const [order, setOrder] = useState<"random" | "sequential">("random");
  const [loading, setLoading] = useState(true);

  const isListRoute = location.pathname.includes("/list/");

  useEffect(() => {
    if (isListRoute) {
      loadList();
    } else {
      loadCollection();
    }
  }, [id, isListRoute]);

  const loadList = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("lists")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar lista");
      navigate("/");
      return;
    }

    if (!data) {
      toast.error("Lista não encontrada");
      navigate("/");
      return;
    }

    setList(data);
    setLoading(false);
  };

  const loadCollection = async () => {
    if (!id) return;

    const { data, error } = await supabase
      .from("collections")
      .select("*")
      .eq("id", id)
      .maybeSingle();

    if (error) {
      toast.error("Erro ao carregar coleção");
      navigate("/");
      return;
    }

    if (!data) {
      toast.error("Coleção não encontrada");
      navigate("/");
      return;
    }

    setCollection(data);
    setLoading(false);
  };

  const startGame = (mode: "flip" | "write" | "mixed") => {
    const basePath = isListRoute ? `/list/${id}` : `/collection/${id}`;
    navigate(`${basePath}/study?mode=${mode}&dir=${direction}&order=${order}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Carregando...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => {
            if (window.history.length > 1) {
              navigate(-1);
            } else {
              navigate("/auth", { replace: true });
            }
          }}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
        </div>

        {(collection || list) && (
          <div className="mb-12 text-center">
            <h1 className="text-4xl font-bold mb-2">Hub de Jogos</h1>
            <p className="text-xl text-muted-foreground">
              {isListRoute ? list?.title : collection?.name}
            </p>
            {(isListRoute ? list?.description : collection?.description) && (
              <p className="text-muted-foreground mt-2">
                {isListRoute ? list?.description : collection?.description}
              </p>
            )}
          </div>
        )}

        <div className="max-w-4xl mx-auto space-y-8">
          <div className="grid md:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-medium mb-2 block">Direção</label>
              <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pt-en">PT → EN</SelectItem>
                  <SelectItem value="en-pt">EN → PT</SelectItem>
                  <SelectItem value="any">Misturar</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Ordem</label>
              <Select value={order} onValueChange={(v: any) => setOrder(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Aleatória</SelectItem>
                  <SelectItem value="sequential">Sequencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            <Card
              className="p-6 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => startGame("flip")}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <RotateCcw className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Virar Cartas</h3>
                <p className="text-sm text-muted-foreground">
                  Veja a frente e tente lembrar o verso antes de revelar
                </p>
              </div>
            </Card>

            <Card
              className="p-6 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => startGame("write")}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Pencil className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Praticar Escrita</h3>
                <p className="text-sm text-muted-foreground">
                  Digite as traduções e receba correção em tempo real
                </p>
              </div>
            </Card>

            <Card
              className="p-6 hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => startGame("mixed")}
            >
              <div className="text-center space-y-4">
                <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Layers3 className="h-8 w-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Estudar (Misto)</h3>
                <p className="text-sm text-muted-foreground">
                  Alterna entre virar cartas e praticar escrita
                </p>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesHub;
