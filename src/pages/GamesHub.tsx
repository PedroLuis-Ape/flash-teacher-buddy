import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useParams, useLocation, useMatch } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { resolveEffectiveListSettings, getLangLabel } from "@/features/study/lib/resolveStudySides";
import { normalizeDirection, type Direction } from "@/features/study/lib/gameCore";
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
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, RotateCcw, Pencil, Layers3, ListOrdered, Star, Mic } from "lucide-react";
import { toast } from "sonner";
import { isPortalPath, buildBasePath } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { useIsMutating } from "@tanstack/react-query";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useAuth } from "@/contexts/AuthContext";
import { normalizeStudyMode, studyModeToUrlParam, type StudyMode } from "@/features/study/lib/studyMode";

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

interface ListSettings {
  labelsA: string;
  labelsB: string;
}

const GamesHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [listLabels, setListLabels] = useState<ListSettings>({ labelsA: "Lado A", labelsB: "Lado B" });

  // Use declarative route matching (covers /list/:id/games and /portal/list/:id/games)
  // instead of pathname.includes() — robust against future route additions.
  const isListRoute = Boolean(useMatch("/list/:id/*") || useMatch("/portal/list/:id/*"));

  // PERF: centralized auth (no redundant getUser() / getSession() calls)
  const { user: currentUser } = useAuthUser();
  const userId = currentUser?.id;
  // Clara Master P0 — authStatus is the ONLY gate for "we know who the
  // user is". `userId` alone may be undefined during the auth race window.
  const { status: authStatus } = useAuth();

  // ── Persistent study preferences (single source of truth) ──
  const { prefs, updatePrefs } = useStudyPreferences(userId);
  // Keep a ref mirror of prefs so startGame() always reads the latest value
  // even if invoked synchronously after an updatePrefs() in the same tick.
  // This is a belt-and-suspenders guarantee against stale closures.
  const prefsRef = useRef(prefs);
  useEffect(() => { prefsRef.current = prefs; }, [prefs]);

  // ── Local immediate selection state ──
  // The persistent prefs hook is async (writes through localStorage / queries),
  // so a click on the Select followed immediately by clicking a game button
  // could race the persisted value. We mirror the user's selection in local
  // state and use it directly when starting the game — guarantees the URL
  // reflects exactly what the user just picked.
  const [selectedDirection, setSelectedDirection] = useState<Direction>(prefs.direction);
  const [selectedOrder, setSelectedOrder] = useState<typeof prefs.order>(prefs.order);
  // Sync local state when prefs load asynchronously (first render / userId change)
  useEffect(() => { setSelectedDirection(prefs.direction); }, [prefs.direction]);
  useEffect(() => { setSelectedOrder(prefs.order); }, [prefs.order]);

  // PERF: cached metadata fetches with longer staleTime so back/forth navigation
  // between list → hub → study → hub does not refetch unnecessarily.
  const { data: list, isLoading: listLoading } = useQuery({
    queryKey: ["gameshub-list", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lists")
        .select("id, title, description, folder_id, study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
        .eq("id", id!)
        .is("deleted_at", null)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id && isListRoute,
    staleTime: 5 * 60_000,
  });

  const { data: folderRow } = useQuery({
    queryKey: ["gameshub-folder", list?.folder_id],
    queryFn: async () => {
      if (!list?.folder_id) return null;
      const { data } = await supabase
        .from("folders")
        .select("study_type, lang_a, lang_b, labels_a, labels_b, tts_enabled")
        .eq("id", list.folder_id)
        .maybeSingle();
      return data;
    },
    enabled: !!list?.folder_id,
    staleTime: 5 * 60_000,
  });

  const { data: collection, isLoading: collectionLoading } = useQuery({
    queryKey: ["gameshub-collection", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("collections")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as Collection | null;
    },
    enabled: !!id && !isListRoute,
    staleTime: 5 * 60_000,
  });

  // Resolve labels once metadata is in
  useEffect(() => {
    if (!list) return;
    const resolved = resolveEffectiveListSettings(list, folderRow ?? null);
    setListLabels({ labelsA: resolved.labelsA, labelsB: resolved.labelsB });
  }, [list, folderRow]);

  // Handle errors via effects (kept light to preserve original UX)
  useEffect(() => {
    if (isListRoute && !listLoading && !list && id) {
      toast.error("Lista não encontrada");
    }
    if (!isListRoute && !collectionLoading && !collection && id) {
      toast.error("Coleção não encontrada");
    }
  }, [isListRoute, listLoading, list, collectionLoading, collection, id]);

  const loading = isListRoute ? listLoading : collectionLoading;

  const favoritesScope = useMemo(() => {
    if (!id) return undefined;
    return isListRoute ? { listId: id } : { collectionId: id };
  }, [id, isListRoute]);

  // Single source of truth: list of IDs + count come from the SAME query.
  const favoritesQuery = useFavorites(userId, 'flashcard', favoritesScope);
  const favorites = favoritesQuery.data ?? [];
  const favoritesCount = favorites.length;
  const favoritesLoading = favoritesQuery.isLoading;
  const favoritesSyncing =
    favoritesQuery.isLoading ||
    favoritesQuery.isFetching ||
    favoritesQuery.isPlaceholderData;
  // Any in-flight favorite-related mutation blocks the auto-reset too.
  const favoritesMutating = useIsMutating({
    predicate: (m) => {
      const k = m.options.mutationKey as unknown[] | undefined;
      const key = Array.isArray(k) ? String(k[0] ?? '') : '';
      return key.startsWith('favorite') || key.startsWith('red');
    },
  }) > 0;

  // Clara Master P0 — DO NOT auto-reset `favoritesOnly`. The previous logic
  // silently rewrote the user's persistent preference whenever the query
  // came back empty for any reason (auth race, fetching, placeholder,
  // outbox pending). The user perceived this as "favorites lost on
  // cold restart". The empty state is now shown in the UI and the user
  // toggles the filter off explicitly when they want to study all cards.
  //
  // Keeping the previous variables (favoritesSyncing, favoritesMutating)
  // referenced so future contributors can re-enable a guarded reset behind
  // an explicit product decision — but they are intentionally unused now.
  void favoritesSyncing;
  void favoritesMutating;
  void authStatus;

  const startGame = (rawMode: StudyMode | "multiple") => {
    // Normalize any alias (e.g. "multiple" → "multiple-choice") before persisting.
    // This is the single entry point from the hub into the study session.
    const mode = normalizeStudyMode(rawMode);
    updatePrefs({ mode });

    // SSOT for the URL = local selection state (what the user just picked in
    // the Selects). This sidesteps any race with the async prefs writer.
    // Favorites toggle is stable enough to read from the ref.
    const liveDirection = selectedDirection;
    const liveOrder = selectedOrder;
    const liveFavoritesOnly = prefsRef.current.favoritesOnly;

    const kind = isListRoute ? "list" : "collection";
    const basePath = buildBasePath(location.pathname, kind, id!);
    // Only forward favorites=true if the list actually has favorites — guards against
    // a stale flag bleeding from a previous list (the auto-reset effect handles state,
    // this guards the URL too).
    const useFavorites = liveFavoritesOnly && favoritesCount > 0;
    const favParam = useFavorites ? "&favorites=true" : "";

    if (import.meta.env.DEV) {
      console.debug("[GamesHub] startGame", {
        rawMode, mode, kind, basePath,
        direction: liveDirection, order: liveOrder,
        favoritesOnly: liveFavoritesOnly, favoritesCount, useFavorites,
      });
    }

    navigate(`${basePath}/study?mode=${studyModeToUrlParam(mode)}&dir=${liveDirection}&order=${liveOrder}${favParam}`);
  };

  const handleBack = () => {
    const onPortal = isPortalPath(location.pathname);
    
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

  // PERF: render layout immediately with skeleton header instead of full-screen blocker.
  // The controls below render with safe defaults; the title appears once metadata resolves.
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-6">
          <h1 className="text-2xl font-bold">Hub de jogos</h1>
          {loading ? (
            <Skeleton className="h-4 w-48 mt-2" />
          ) : (
            <p className="text-sm text-muted-foreground mt-1">
              {isListRoute ? list?.title : collection?.name}
            </p>
          )}
        </div>

        <div className="max-w-6xl mx-auto space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium mb-1.5 block">Direção</label>
              <Select
                value={selectedDirection}
                onValueChange={(v) => {
                  const dir = normalizeDirection(v);
                  setSelectedDirection(dir);   // immediate, no race
                  updatePrefs({ direction: dir }); // persist
                }}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="a-b">{listLabels.labelsA} → {listLabels.labelsB}</SelectItem>
                  <SelectItem value="b-a">{listLabels.labelsB} → {listLabels.labelsA}</SelectItem>
                  <SelectItem value="any">Misto</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block">Ordem</label>
              <Select
                value={selectedOrder}
                onValueChange={(v: any) => {
                  setSelectedOrder(v);
                  updatePrefs({ order: v });
                }}
              >
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

          {/* Favorites filter — sempre visível para usuários logados, mesmo com 0 favoritos.
              Garantia: o controle nunca fica oculto enquanto a preferência pode estar ativa por baixo. */}
          {userId && (
            <div className="flex items-center justify-between p-3 rounded-lg border bg-card">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <Label htmlFor="favorites-only" className="cursor-pointer">
                  <span className="font-medium">Estudar apenas favoritos</span>
                  <p className="text-xs text-muted-foreground">
                    {favoritesSyncing
                      ? "Atualizando favoritos..."
                      : favoritesCount > 0
                      ? `${favoritesCount} cards marcados como favorito`
                      : "Nenhum favorito nesta lista"}
                  </p>
                </Label>
              </div>
              <Switch
                id="favorites-only"
                disabled={favoritesSyncing || favoritesCount === 0}
                checked={prefs.favoritesOnly && favoritesCount > 0}
                onCheckedChange={(v) => updatePrefs({ favoritesOnly: v })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2">
            <button
              onClick={() => startGame("flip")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Virar Cartas</span>
            </button>

            <button
              onClick={() => startGame("write")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Pencil className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Escrever</span>
            </button>

            <button
              onClick={() => startGame("multiple")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <ListOrdered className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Múltipla Escolha</span>
            </button>

            <button
              onClick={() => startGame("unscramble")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <Layers3 className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Desembaralhar</span>
            </button>

            <button
              onClick={() => startGame("mixed")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border bg-card hover:bg-accent hover:-translate-y-0.5 hover:shadow-md transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                <RotateCcw className="h-5 w-5 text-primary" />
              </div>
              <span className="text-sm font-semibold">Estudo Misto</span>
            </button>

            <button
              onClick={() => startGame("pronunciation")}
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-orange-500/30 bg-orange-500/5 hover:bg-orange-500/10 hover:-translate-y-0.5 hover:shadow-md transition-all"
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
