import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useMatch, useNavigate, useParams } from "react-router-dom";
import { useQuery, useIsMutating } from "@tanstack/react-query";
import { ArrowLeft, Layers3, ListOrdered, Mic, Pencil, RotateCcw, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
import { resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import { normalizeStudyMode, studyModeToUrlParam, type StudyMode } from "@/features/study/lib/studyMode";
import { buildBasePath, isPortalPath } from "@/lib/utils";
import { loadListPrimarySide } from "@/lib/loadListPrimarySide";
import { loadPublicSide } from "@/lib/loadPublicSide";
import { primarySideToDirection } from "@/lib/primarySideDirection";

type Collection = { id: string; name: string; description?: string };
type ListRow = { id: string; title: string; description?: string; folder_id?: string; primary_side?: string } & Record<string, unknown>;

const games: Array<{ mode: StudyMode | "multiple"; label: string; icon: React.ReactNode; orange?: boolean }> = [
  { mode: "flip", label: "Virar Cartas", icon: <RotateCcw className="h-5 w-5 text-primary" /> },
  { mode: "write", label: "Escrever", icon: <Pencil className="h-5 w-5 text-primary" /> },
  { mode: "multiple", label: "Múltipla Escolha", icon: <ListOrdered className="h-5 w-5 text-primary" /> },
  { mode: "unscramble", label: "Desembaralhar", icon: <Layers3 className="h-5 w-5 text-primary" /> },
  { mode: "mixed", label: "Estudo Misto", icon: <RotateCcw className="h-5 w-5 text-primary" /> },
  { mode: "pronunciation", label: "Prática de Pronúncia", icon: <Mic className="h-5 w-5 text-orange-500" />, orange: true },
];

export default function GamesHub() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const isListRoute = Boolean(useMatch("/list/:id/*") || useMatch("/portal/list/:id/*"));
  const { user } = useAuthUser();
  const { status } = useAuth();
  const userId = user?.id;
  const { prefs, updatePrefs } = useStudyPreferences(userId);
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  const [labels, setLabels] = useState({ a: "Lado A", b: "Lado B" });
  const [primarySide, setPrimarySide] = useState<"a" | "b">("a");
  const [direction, setDirection] = useState<Direction>(prefs.direction);
  const [order, setOrder] = useState(prefs.order);
  const directionTouched = useRef(false);

  const listQuery = useQuery({
    queryKey: ["gameshub-list", id],
    queryFn: async () => {
      const result = await supabase.from("lists").select("*").eq("id", id!).is("deleted_at", null).single();
      if (result.error) throw result.error;
      return result.data as ListRow;
    },
    enabled: !!id && isListRoute,
    staleTime: 300_000,
  });
  const list = listQuery.data;

  const folderQuery = useQuery({
    queryKey: ["gameshub-folder", list?.folder_id],
    queryFn: async () => {
      if (!list?.folder_id) return null;
      return (await supabase.from("folders").select("study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled").eq("id", list.folder_id).maybeSingle()).data;
    },
    enabled: !!list?.folder_id,
    staleTime: 300_000,
  });

  const collectionQuery = useQuery({
    queryKey: ["gameshub-collection", id],
    queryFn: async () => {
      const result = await supabase.from("collections").select("*").eq("id", id!).maybeSingle();
      if (result.error) throw result.error;
      return result.data as Collection | null;
    },
    enabled: !!id && !isListRoute,
    staleTime: 300_000,
  });

  useEffect(() => {
    if (!list) return;
    const resolved = resolveEffectiveListSettings(list, folderQuery.data ?? null);
    setLabels({ a: resolved.labelsA, b: resolved.labelsB });
  }, [folderQuery.data, list]);

  useEffect(() => {
    if (!id || !isListRoute) {
      setDirection(prefs.direction);
      return;
    }
    const params = new URLSearchParams(location.search);
    const explicit = params.get("dir") || params.get("direction");
    if (explicit === "a-b" || explicit === "b-a" || explicit === "any") {
      directionTouched.current = true;
      setDirection(explicit);
      return;
    }
    let active = true;
    const loader = location.pathname.startsWith("/portal/list/") ? loadPublicSide : loadListPrimarySide;
    loader(id).then((side) => {
      if (!active || directionTouched.current) return;
      setPrimarySide(side);
      setDirection(primarySideToDirection(side));
    }).catch(() => active && setDirection("a-b"));
    return () => { active = false; };
  }, [id, isListRoute, location.pathname, location.search, prefs.direction]);

  useEffect(() => { setOrder(prefs.order); }, [prefs.order]);
  useEffect(() => {
    if (isListRoute && !listQuery.isLoading && !list && id) toast.error("Lista não encontrada");
    if (!isListRoute && !collectionQuery.isLoading && !collectionQuery.data && id) toast.error("Coleção não encontrada");
  }, [collectionQuery.data, collectionQuery.isLoading, id, isListRoute, list, listQuery.isLoading]);

  const scope = useMemo(() => !id ? undefined : isListRoute ? { listId: id } : { collectionId: id }, [id, isListRoute]);
  const favoritesQuery = useFavorites(userId, "flashcard", scope);
  const favoritesCount = (favoritesQuery.data ?? []).length;
  const favoritesSyncing = favoritesQuery.isLoading || favoritesQuery.isFetching || favoritesQuery.isPlaceholderData;
  const favoritesMutating = useIsMutating({ predicate: (mutation) => String((mutation.options.mutationKey as unknown[] | undefined)?.[0] ?? "").startsWith("favorite") }) > 0;
  void favoritesMutating;
  void status;

  const start = (rawMode: StudyMode | "multiple") => {
    const mode = normalizeStudyMode(rawMode);
    updatePrefs({ mode });
    const base = buildBasePath(location.pathname, isListRoute ? "list" : "collection", id!);
    const favorites = prefsRef.current.favoritesOnly && favoritesCount > 0 ? "&favorites=true" : "";
    navigate(`${base}/study?mode=${studyModeToUrlParam(mode)}&dir=${direction}&order=${order}${favorites}`);
  };

  const back = () => {
    if (window.history.state?.idx > 0) return navigate(-1);
    const portal = isPortalPath(location.pathname);
    if (collectionQuery.data) return navigate(`/collection/${collectionQuery.data.id}`);
    if (list?.folder_id) return navigate(portal ? `/portal/folder/${list.folder_id}` : `/folder/${list.folder_id}`);
    navigate(portal ? "/portal" : "/folders");
  };

  const loading = isListRoute ? listQuery.isLoading : collectionQuery.isLoading;
  return <div className="min-h-screen bg-background"><div className="container mx-auto px-4 py-6">
    <Button variant="ghost" size="sm" onClick={back} className="mb-4"><ArrowLeft className="mr-2 h-4 w-4" />Voltar</Button>
    <div className="mb-6"><h1 className="text-2xl font-bold">Hub de jogos</h1>{loading ? <Skeleton className="h-4 w-48 mt-2" /> : <p className="text-sm text-muted-foreground mt-1">{isListRoute ? list?.title : collectionQuery.data?.name}</p>}</div>
    <div className="max-w-6xl mx-auto space-y-4">
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="text-xs font-medium mb-1.5 block">Direção desta sessão</label><Select value={direction} onValueChange={(value) => { const next = normalizeDirection(value); directionTouched.current = true; setDirection(next); if (!isListRoute) updatePrefs({ direction: next }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="a-b">{labels.a} → {labels.b}</SelectItem><SelectItem value="b-a">{labels.b} → {labels.a}</SelectItem><SelectItem value="any">Misto</SelectItem></SelectContent></Select>{isListRoute && <p className="mt-1 text-[11px] text-muted-foreground">Padrão da lista: {primarySide === "b" ? labels.b : labels.a}</p>}</div>
        <div><label className="text-xs font-medium mb-1.5 block">Ordem</label><Select value={order} onValueChange={(value: "random" | "sequential") => { setOrder(value); updatePrefs({ order: value }); }}><SelectTrigger className="h-9"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="random">Aleatória</SelectItem><SelectItem value="sequential">Sequencial</SelectItem></SelectContent></Select></div>
      </div>
      {userId && <div className="flex items-center justify-between p-3 rounded-lg border bg-card"><div className="flex items-center gap-2"><Star className="h-4 w-4 text-yellow-500" /><Label htmlFor="favorites-only"><span className="font-medium">Estudar apenas favoritos</span><p className="text-xs text-muted-foreground">{favoritesSyncing ? "Atualizando favoritos..." : favoritesCount ? `${favoritesCount} cards marcados como favorito` : "Nenhum favorito nesta lista"}</p></Label></div><Switch id="favorites-only" disabled={favoritesSyncing || !favoritesCount} checked={prefs.favoritesOnly && favoritesCount > 0} onCheckedChange={(value) => updatePrefs({ favoritesOnly: value })} /></div>}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">{games.map((game) => <button key={game.mode} onClick={() => start(game.mode)} className={`flex flex-col items-center gap-2 p-4 rounded-lg border hover:-translate-y-0.5 hover:shadow-md transition-all ${game.orange ? "border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10" : "bg-card hover:bg-accent"}`}><div className={`w-10 h-10 rounded-full flex items-center justify-center ${game.orange ? "bg-orange-500/10" : "bg-primary/10"}`}>{game.icon}</div><span className="text-sm font-semibold">{game.label}</span></button>)}</div>
    </div>
  </div></div>;
}
