import { useEffect, useMemo, useState } from "react";
import { useLocation, useMatch, useNavigate, useParams } from "react-router-dom";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { ArrowLeft, RotateCcw, Save, Star, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { resolveEffectiveListSettings } from "@/features/study/lib/resolveStudySides";
import { normalizeDirection } from "@/features/study/lib/gameCore";
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
import { toast } from "sonner";
import { buildBasePath, cn, isPortalPath } from "@/lib/utils";
import { useFavorites } from "@/hooks/useFavorites";
import { useStudyPreferences } from "@/hooks/useStudyPreferences";
import { useAuthUser } from "@/hooks/useAuthUser";
import { normalizeStudyMode, studyModeToUrlParam, type StudyMode } from "@/features/study/lib/studyMode";
import {
  GAME_MODE_VISUALS,
  type GameModeVisualKey,
} from "@/features/study/lib/gameModeVisuals";

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

const gameOptions: Array<{
  mode: StudyMode | "multiple";
  visualKey: GameModeVisualKey;
  title: string;
  beta?: boolean;
  recommended?: boolean;
}> = [
  { mode: "flip", visualKey: "flip", title: "Virar Cartas" },
  { mode: "write", visualKey: "write", title: "Escrever" },
  { mode: "multiple", visualKey: "multiple", title: "Múltipla Escolha" },
  { mode: "unscramble", visualKey: "unscramble", title: "Desembaralhar" },
  { mode: "mixed", visualKey: "mixed", title: "Prática Mista", recommended: true },
  { mode: "pronunciation", visualKey: "pronunciation", title: "Prática de Pronúncia", beta: true },
];

const GamesHub = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [listLabels, setListLabels] = useState<ListSettings>({ labelsA: "Lado A", labelsB: "Lado B" });

  const isListRoute = Boolean(useMatch("/list/:id/*") || useMatch("/portal/list/:id/*"));
  const isPrivateList = isListRoute && !isPortalPath(location.pathname);

  const { user: currentUser } = useAuthUser();
  const userId = currentUser?.id;
  const {
    effectivePreset,
    source,
    isHydrating,
    updateForCurrentScope,
    saveAsGlobal,
    resetListOverride,
  } = useStudyPreferences(userId, {
    listId: isPrivateList ? id : undefined,
    persistScope: isPrivateList ? "list" : "global",
    canPersistList: isPrivateList,
  });

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

  useEffect(() => {
    if (!list) return;
    const resolved = resolveEffectiveListSettings(list, folderRow ?? null);
    setListLabels({ labelsA: resolved.labelsA, labelsB: resolved.labelsB });
  }, [list, folderRow]);

  useEffect(() => {
    if (isListRoute && !listLoading && !list && id) toast.error("Lista não encontrada");
    if (!isListRoute && !collectionLoading && !collection && id) toast.error("Coleção não encontrada");
  }, [isListRoute, listLoading, list, collectionLoading, collection, id]);

  const loading = isListRoute ? listLoading : collectionLoading;

  const favoritesScope = useMemo(() => {
    if (!id) return undefined;
    return isListRoute ? { listId: id } : { collectionId: id };
  }, [id, isListRoute]);

  const favoritesQuery = useFavorites(userId, "flashcard", favoritesScope);
  const favorites = favoritesQuery.data ?? [];
  const favoritesCount = favorites.length;
  const favoritesSyncing = favoritesQuery.isLoading
    || favoritesQuery.isFetching
    || favoritesQuery.isPlaceholderData;
  const favoritesMutating = useIsMutating({
    predicate: (mutation) => {
      const keyParts = mutation.options.mutationKey as unknown[] | undefined;
      const key = Array.isArray(keyParts) ? String(keyParts[0] ?? "") : "";
      return key.startsWith("favorite") || key.startsWith("red");
    },
  }) > 0;
  const favoritesBusy = favoritesSyncing || favoritesMutating;

  const startGame = (rawMode: StudyMode | "multiple") => {
    if (!id) return;
    const mode = normalizeStudyMode(rawMode);
    const launchPreset = { ...effectivePreset, mode };
    updateForCurrentScope({ mode });

    const kind = isListRoute ? "list" : "collection";
    const basePath = buildBasePath(location.pathname, kind, id);
    const useFavoritesOnly = launchPreset.scope === "favorites" && favoritesCount > 0;
    const params = new URLSearchParams({
      mode: studyModeToUrlParam(mode),
      dir: launchPreset.direction,
      order: launchPreset.order,
      fastMode: String(launchPreset.fastMode),
    });
    if (useFavoritesOnly) params.set("favorites", "true");

    const route = mode === "mixed" ? "mixed-study" : "study";
    navigate(`${basePath}/${route}?${params.toString()}`);
  };

  const handleBack = () => {
    const onPortal = isPortalPath(location.pathname);
    if (window.history.state?.idx > 0) {
      navigate(-1);
    } else if (collection) {
      navigate(`/collection/${collection.id}`);
    } else if (list) {
      if (onPortal && list.folder_id) navigate(`/portal/folder/${list.folder_id}`);
      else if (list.folder_id) navigate(`/folder/${list.folder_id}`);
      else navigate(onPortal ? "/portal" : "/folders");
    } else {
      navigate(onPortal ? "/portal" : "/folders");
    }
  };

  const handleResetListPreset = async () => {
    await resetListOverride();
    toast.success("Esta lista voltou a usar o padrão global.");
  };

  const handleSaveAsGlobal = async () => {
    await saveAsGlobal(effectivePreset);
    toast.success("Estas configurações agora são o seu padrão global.");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-3 py-4 sm:px-4 sm:py-6">
        <Button variant="ghost" size="sm" onClick={handleBack} className="mb-3 sm:mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>

        <div className="mb-4 sm:mb-6">
          <h1 className="text-2xl font-bold">Hub de jogos</h1>
          {loading ? (
            <Skeleton className="mt-2 h-4 w-48" />
          ) : (
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {isListRoute ? list?.title : collection?.name}
            </p>
          )}
        </div>

        <div className="mx-auto max-w-6xl space-y-4">
          <div className="rounded-xl border bg-card/95 p-3 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold">
                  {isPrivateList && source === "list" ? "Personalizado nesta lista" : "Padrão global"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {isHydrating ? "Sincronizando com sua conta..." : "Suas escolhas serão lembradas automaticamente."}
                </p>
              </div>
              {isPrivateList && userId && (
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleResetListPreset}
                    disabled={source !== "list"}
                  >
                    <RotateCcw className="mr-2 h-4 w-4" />
                    Restaurar padrão global
                  </Button>
                  <Button type="button" variant="outline" size="sm" onClick={handleSaveAsGlobal}>
                    <Save className="mr-2 h-4 w-4" />
                    Usar como padrão global
                  </Button>
                </div>
              )}
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1.5 block text-xs font-medium">Direção</label>
                <Select
                  value={effectivePreset.direction}
                  onValueChange={(value) => updateForCurrentScope({ direction: normalizeDirection(value) })}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="a-b">{listLabels.labelsA} → {listLabels.labelsB}</SelectItem>
                    <SelectItem value="b-a">{listLabels.labelsB} → {listLabels.labelsA}</SelectItem>
                    <SelectItem value="any">Alternar lados</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-medium">Ordem dos cards</label>
                <Select
                  value={effectivePreset.order}
                  onValueChange={(value: "random" | "sequential") => updateForCurrentScope({ order: value })}
                >
                  <SelectTrigger className="h-10"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="random">Aleatória</SelectItem>
                    <SelectItem value="sequential">Sequencial</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                <div className="flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-500" />
                  <div>
                    <Label htmlFor="hub-fast-mode" className="cursor-pointer font-medium">Fast Mode</Label>
                    <p className="text-xs text-muted-foreground">Mostra os dois lados no Flip</p>
                  </div>
                </div>
                <Switch
                  id="hub-fast-mode"
                  checked={effectivePreset.fastMode}
                  onCheckedChange={(fastMode) => updateForCurrentScope({ fastMode })}
                />
              </div>
            </div>
          </div>

          {userId && (
            <div className="flex items-center justify-between rounded-lg border bg-card/95 p-3 shadow-sm">
              <div className="flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                <Label htmlFor="favorites-only" className="cursor-pointer">
                  <span className="font-medium">Estudar apenas favoritos</span>
                  <p className="text-xs text-muted-foreground">
                    {favoritesSyncing
                      ? "Atualizando favoritos..."
                      : favoritesCount > 0
                        ? `${favoritesCount} cards marcados como favorito`
                        : "Nenhum favorito nesta lista; o jogo usará todos sem apagar sua preferência."}
                  </p>
                </Label>
              </div>
              <Switch
                id="favorites-only"
                disabled={favoritesBusy || favoritesCount === 0}
                checked={effectivePreset.scope === "favorites" && favoritesCount > 0}
                onCheckedChange={(value) => updateForCurrentScope({ scope: value ? "favorites" : "all" })}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 pt-1 sm:grid-cols-3 lg:grid-cols-6">
            {gameOptions.map(({ mode, visualKey, title, beta, recommended }) => {
              const visual = GAME_MODE_VISUALS[visualKey];
              const normalizedMode = normalizeStudyMode(mode);
              const isRemembered = effectivePreset.mode === normalizedMode;
              return (
                <button
                  key={mode}
                  type="button"
                  onClick={() => startGame(mode)}
                  className={cn(
                    "relative flex min-h-[112px] flex-col items-center justify-center gap-3 rounded-xl border p-3 text-center shadow-sm transition-all",
                    "hover:-translate-y-0.5 hover:shadow-md",
                    recommended && "border-primary/60 ring-2 ring-primary/15",
                    isRemembered && "outline outline-2 outline-primary/50",
                    visual.cardClass,
                  )}
                >
                  {recommended && (
                    <span className="absolute left-2 top-2 rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-primary-foreground shadow-sm">
                      RECOMENDADO
                    </span>
                  )}
                  {beta && (
                    <span className="absolute right-2 top-2 rounded-full bg-red-600 px-2 py-0.5 text-[9px] font-extrabold tracking-wide text-white shadow-sm">
                      BETA
                    </span>
                  )}
                  <span
                    className={cn(
                      "flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl shadow-sm",
                      visual.tileClass,
                    )}
                    aria-hidden="true"
                    title={visual.emojiLabel}
                  >
                    {visual.emoji}
                  </span>
                  <span className="text-sm font-semibold leading-tight">{title}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GamesHub;
