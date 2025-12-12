import { useState, useEffect } from "react";
import { useNavigate, useParams, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCcw, Pencil, Layers3, ListOrdered, Star, Mic } from "lucide-react";
import { toast } from "sonner";
import { isPortalPath, buildBasePath } from "@/lib/utils";
import { useFavoritesCount } from "@/hooks/useFavorites";

interface Collection {
  id: string;
  name: string;
  description?: string;
}

interface List {
  id: string;
  title: string;
  description?: string;
  folder_id?: string;
}

const GamesHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [collection, setCollection] = useState<Collection | null>(null);
  const [list, setList] = useState<List | null>(null);
  const [direction, setDirection] = useState<"pt-en" | "en-pt" | "any">("any");
  const [order, setOrder] = useState<"random" | "sequential">("random");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | undefined>();

  const isListRoute = location.pathname.includes("/list/");
  
  // Fetch user ID for favorites count
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id);
    };
    fetchUser();
  }, []);
  
  const { data: favoritesCount = 0 } = useFavoritesCount(userId, 'flashcard');

  useEffect(() => {
    if (isListRoute) {
      loadList();
    } else {
      loadCollection();
    }
  }, [id, isListRoute]);

  const loadList = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      // Se não tiver sessão, tentar carregar como público
      if (!session) {
        const { data, error } = await supabase
          .from("lists")
          .select("*")
          .eq("id", id)
          .single();

        if (error) {
          console.error("Erro ao carregar lista pública:", error);
          toast.error("Lista não encontrada ou não está compartilhada");
          navigate("/portal");
          return;
        }
        setList(data);
        setLoading(false);
        return;
      }

      // Fluxo normal para usuários logados
      const { data, error } = await supabase
        .from("lists")
        .select("*")
        .eq("id", id)
        .single();

      if (error) throw error;
      setList(data);
      setLoading(false);
    } catch (error: any) {
      toast.error("Erro ao carregar lista");
      console.error(error);
      setLoading(false);
    }
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

  const startGame = (mode: "flip" | "write" | "mixed" | "multiple" | "unscramble" | "pronunciation") => {
    const kind = isListRoute ? "list" : "collection";
    const basePath = buildBasePath(location.pathname, kind, id!);
    const favParam = favoritesOnly ? "&favorites=true" : "";
    navigate(`${basePath}/study?mode=${mode}&dir=${direction}&order=${order}${favParam}`);
  };

  // FIX: Safe back navigation to avoid infinite loop
  const handleBack = () => {
    const onPortal = isPortalPath(location.pathname);
    
    // Check if we have valid history to go back
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else if (collection) {
      navigate(`/collection/${collection.id}`);
    } else if (list) {
      if (onPortal && list.folder_id) {
        navigate(`/portal/folder/${list.folder_id}`);
      } else if (list.folder_id) {
        navigate(`/folder/${list.folder_id}`);
      } else {
        navigate(onPortal ? "/portal" : "/folders");
      }
    } else {
      navigate(onPortal ? "/portal" : "/folders");
    }
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
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        {(collection || list) && (
          <div className="mb-6">
            <h1 className="text-2xl font-bold">Hub de jogos</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isListRoute ? list?.title : collection?.name}
            </p>
          </div>
        )}

        <div className="max-w-5xl mx-auto space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Direção</label>
              <Select value={direction} onValueChange={(v: any) => setDirection(v)}>
                <SelectTrigger className="h-9">
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
              <label className="text-xs font-medium mb-1.5 block">Ordem</label>
              <Select value={order} onValueChange={(v: any) => setOrder(v)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="random">Aleatória</SelectItem>
                  <SelectItem value="sequential">Sequencial</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Favorites filter */}
          {userId && favoritesCount > 0 && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <Label htmlFor="favorites-only" className="cursor-pointer">
                  <span className="font-medium">Estudar apenas favoritos</span>
                  <p className="text-xs text-muted-foreground">
                    {favoritesCount} cards marcados como favorito
                  </p>
                </Label>
              </div>
              <Switch
                id="favorites-only"
                checked={favoritesOnly}
                onCheckedChange={setFavoritesOnly}
              />
            </div>
          )}

          {/* FIX: Mobile-friendly button layout */}
          <div className="flex flex-row flex-wrap gap-3 justify-center w-full pt-2">
            <button
              onClick={() => startGame("flip")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Virar Cartas</span>
            </button>

            <button
              onClick={() => startGame("write")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Escrever</span>
            </button>

            <button
              onClick={() => startGame("multiple")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ListOrdered className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Múltipla Escolha</span>
            </button>

            <button
              onClick={() => startGame("unscramble")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Layers3 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Desembaralhar</span>
            </button>

            <button
              onClick={() => startGame("mixed")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Estudo Misto</span>
            </button>

            <button
              onClick={() => startGame("pronunciation")}
              className="flex-1 min-w-[140px] flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent transition-colors border-orange-500/30 bg-orange-500/5"
            >
              <div className="w-10 h-10 rounded-full bg-orange-500/10 flex items-center justify-center">
                <Mic className="h-5 w-5 text-orange-500" />
              </div>
              <span className="text-sm font-semibold">Prática de Pronúncia</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesHub;
