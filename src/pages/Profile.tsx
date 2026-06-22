import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeTabs } from "@/components/ape/ApeTabs";
import { DeckTab } from "@/features/study/components/DeckTab";
import { HistoryTab } from "@/components/HistoryTab";
import { StatisticsTab } from "@/components/StatisticsTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Camera,
  Copy,
  Expand,
  Image as ImageIcon,
  Keyboard,
  LogOut,
  RefreshCw,
  Settings,
  Sparkles,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { equipAvatarAsPhoto } from "@/lib/storeEngine";
import { GoogleAccountSection } from "@/features/auth/components/GoogleAccountSection";

type PreviewAsset = {
  src: string;
  title: string;
  kind: "avatar" | "mascot";
};

const Profile = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mascotUrl, setMascotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPhotoDialog, setShowPhotoDialog] = useState(false);
  const [previewAsset, setPreviewAsset] = useState<PreviewAsset | null>(null);
  const [equippedAvatarSkinId, setEquippedAvatarSkinId] = useState<string | null>(null);
  const [isCheckingUpdate, setIsCheckingUpdate] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleCheckForUpdates = async () => {
    if (isCheckingUpdate) return;
    setIsCheckingUpdate(true);
    toast.info("Buscando atualizações...");
    try {
      if ("serviceWorker" in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((registration) => registration.unregister()));
      }
      if (typeof caches !== "undefined") {
        const names = await caches.keys();
        await Promise.all(names.map((name) => caches.delete(name)));
      }
      try { localStorage.removeItem("app_build_id"); } catch { /* noop */ }
      try { sessionStorage.removeItem("app_build_reload_guard"); } catch { /* noop */ }
    } catch (error) {
      console.warn("[Profile] Update check cleanup failed:", error);
    } finally {
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.set("_u", Date.now().toString());
        window.location.replace(url.toString());
      }, 400);
    }
  };

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, user_tag, avatar_skin_id, mascot_skin_id, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) return;

      setFirstName(profile.first_name || "");
      setEmail(session.user.email || "");
      setEquippedAvatarSkinId(profile.avatar_skin_id);

      if (!profile.user_tag || !profile.user_tag.match(/^[PA][0-9]{6}$/)) {
        const { initPublicId } = await import("@/lib/profileEngine");
        const result = await initPublicId(session.user.id);
        if (result.success && result.publicId) setPublicId(result.publicId);
      } else {
        setPublicId(profile.user_tag);
      }

      let resolvedAvatarUrl = profile.avatar_url || null;
      if (profile.avatar_skin_id) {
        const { data: avatarData } = await supabase
          .from("public_catalog")
          .select("avatar_final")
          .eq("id", profile.avatar_skin_id)
          .maybeSingle();

        if (avatarData?.avatar_final) resolvedAvatarUrl = avatarData.avatar_final;
      }
      setAvatarUrl(resolvedAvatarUrl);

      if (profile.mascot_skin_id) {
        const { data: mascotData } = await supabase
          .from("public_catalog")
          .select("card_final")
          .eq("id", profile.mascot_skin_id)
          .maybeSingle();

        setMascotUrl(mascotData?.card_final || null);
      } else {
        setMascotUrl(null);
      }
    } catch (error) {
      console.error("[Profile] Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadProfile();
  }, []);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    try {
      setIsLoggingOut(true);
      sessionStorage.setItem("logoutInProgress", "1");
      await supabase.auth.signOut();
      sessionStorage.removeItem("authReady");
      sessionStorage.removeItem("logoutInProgress");
      toast.success("✅ Logout realizado com sucesso");
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("❌ Erro ao fazer logout");
      sessionStorage.removeItem("logoutInProgress");
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCopyId = () => {
    if (!publicId) return;
    void navigator.clipboard.writeText(publicId);
    toast.success("ID copiado!");
  };

  const handleUseEquippedAvatar = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    if (!equippedAvatarSkinId || !avatarUrl) {
      toast.error("Nenhum avatar equipado");
      return;
    }

    try {
      const result = await equipAvatarAsPhoto(session.user.id, equippedAvatarSkinId, avatarUrl);
      if (result.success) {
        toast.success(result.message);
        setShowPhotoDialog(false);
        await loadProfile();
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      console.error("Error setting photo:", error);
      toast.error("Erro ao definir foto de perfil");
    }
  };

  const initials = firstName
    ? firstName.split(" ").map((name) => name[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const overviewTab = (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-3 sm:p-4 lg:p-6">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,0.85fr)_minmax(320px,1.15fr)] lg:items-start">
        <Card className="overflow-hidden rounded-3xl border-primary/15 bg-card/90 p-5 shadow-sm sm:p-6">
          <div className="flex flex-col items-center text-center">
            <div className="relative">
              <button
                type="button"
                onClick={() => avatarUrl && setPreviewAsset({
                  src: avatarUrl,
                  title: "Foto de perfil equipada",
                  kind: "avatar",
                })}
                className="group rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background"
                disabled={!avatarUrl}
                aria-label="Ampliar foto de perfil"
              >
                <Avatar className="h-28 w-28 ring-2 ring-primary/30 shadow-lg sm:h-32 sm:w-32">
                  {avatarUrl ? (
                    <AvatarImage src={avatarUrl} alt="Avatar" className="object-cover" />
                  ) : null}
                  <AvatarFallback className="bg-primary text-3xl text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                {avatarUrl && (
                  <span className="absolute inset-0 grid place-items-center rounded-full bg-black/0 text-white opacity-0 transition group-hover:bg-black/45 group-hover:opacity-100 group-focus-visible:bg-black/45 group-focus-visible:opacity-100">
                    <Expand className="h-6 w-6" />
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setShowPhotoDialog(true)}
                className="absolute bottom-0 right-0 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-colors hover:bg-primary/90"
                aria-label="Alterar foto"
              >
                <Camera className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Toque na imagem para ampliar
            </p>

            <div className="mt-4 space-y-2">
              <h2 className="text-xl font-bold sm:text-2xl">{firstName || "Usuário"}</h2>
              <p className="break-all text-sm text-muted-foreground">{email}</p>
              {publicId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleCopyId}
                  className="mt-2 h-8 gap-2"
                >
                  <span className="font-mono text-sm">{publicId}</span>
                  <Copy className="h-3 w-3" />
                </Button>
              )}
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowPhotoDialog(true)}
              className="mt-4 gap-2"
            >
              <Camera className="h-4 w-4" />
              Alterar foto
            </Button>
          </div>
        </Card>

        <Card className="overflow-hidden rounded-3xl border-primary/15 bg-card/90 shadow-sm">
          <div className="flex items-center justify-between border-b border-border/60 px-4 py-3 sm:px-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.16em] text-primary">Coleção</p>
              <h2 className="text-lg font-bold">Mascote equipado</h2>
            </div>
            <Sparkles className="h-5 w-5 text-primary" />
          </div>

          {mascotUrl ? (
            <button
              type="button"
              onClick={() => setPreviewAsset({
                src: mascotUrl,
                title: "Mascote equipado",
                kind: "mascot",
              })}
              className="group block w-full p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary sm:p-4"
              aria-label="Ampliar mascote equipado"
            >
              <div className="relative mx-auto aspect-[3/4] max-h-[430px] w-full max-w-[340px] overflow-hidden rounded-2xl border border-primary/15 bg-gradient-to-br from-primary/10 via-background to-secondary/10 shadow-inner">
                <img
                  src={mascotUrl}
                  alt="Mascote equipado"
                  className="h-full w-full object-contain p-2 transition-transform duration-300 group-hover:scale-[1.02]"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-2 bg-gradient-to-t from-black/80 via-black/35 to-transparent px-3 pb-3 pt-12 text-sm font-medium text-white opacity-90">
                  <Expand className="h-4 w-4" />
                  Ver em alta definição
                </div>
              </div>
            </button>
          ) : (
            <div className="grid min-h-64 place-items-center p-6 text-center">
              <div>
                <ImageIcon className="mx-auto h-10 w-10 text-muted-foreground" />
                <p className="mt-3 font-medium">Nenhum mascote equipado</p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-3"
                  onClick={() => navigate("/store/inventory")}
                >
                  Abrir inventário
                </Button>
              </div>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2 lg:items-start">
        <GoogleAccountSection />

        <Card className="rounded-3xl border-primary/10 p-3 shadow-sm sm:p-4">
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <Button
              variant="outline"
              className="min-h-[44px] w-full justify-start"
              onClick={handleCheckForUpdates}
              disabled={isCheckingUpdate}
            >
              <RefreshCw className={`mr-2 h-4 w-4 ${isCheckingUpdate ? "animate-spin" : ""}`} />
              {isCheckingUpdate ? "Atualizando..." : "Buscar atualizações"}
            </Button>

            <Button
              variant="outline"
              className="min-h-[44px] w-full justify-start"
              onClick={() => navigate("/settings/performance")}
            >
              <Settings className="mr-2 h-4 w-4" />
              Desempenho e Qualidade
            </Button>

            <Button
              variant="outline"
              className="min-h-[44px] w-full justify-start"
              onClick={() => navigate("/settings/shortcuts")}
            >
              <Keyboard className="mr-2 h-4 w-4" />
              Atalhos de Teclado
            </Button>

            <Button
              variant="outline"
              className="min-h-[44px] w-full justify-start"
              onClick={() => navigate("/folders")}
            >
              <User className="mr-2 h-4 w-4" />
              Editar Perfil
            </Button>

            <Button
              variant="destructive"
              className="min-h-[44px] w-full justify-start font-semibold sm:col-span-2 lg:col-span-1"
              onClick={handleLogout}
              disabled={isLoggingOut}
            >
              <LogOut className="mr-2 h-4 w-4" />
              {isLoggingOut ? "Saindo..." : "Sair da conta"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );

  const tabs = [
    { value: "overview", label: "Perfil", content: overviewTab },
  ];

  if (FEATURE_FLAGS.economy_enabled) {
    tabs.push(
      { value: "deck", label: "Baralho", content: <DeckTab /> },
      { value: "history", label: "Histórico", content: <HistoryTab /> },
      { value: "statistics", label: "Estatísticas", content: <StatisticsTab /> },
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ApeAppBar title="Perfil" showBack backPath="/folders" />
        <div className="flex items-center justify-center py-12">
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Perfil" showBack backPath="/folders" />
      <ApeTabs tabs={tabs} defaultValue="overview" />

      <Dialog open={showPhotoDialog} onOpenChange={setShowPhotoDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Alterar foto de perfil</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-4">
            <Button
              variant="default"
              className="min-h-[44px] w-full justify-start"
              onClick={handleUseEquippedAvatar}
              disabled={!equippedAvatarSkinId}
            >
              <Camera className="mr-2 h-4 w-4" />
              Usar avatar equipado
            </Button>
            <Button
              variant="outline"
              className="min-h-[44px] w-full justify-start"
              onClick={() => {
                setShowPhotoDialog(false);
                navigate("/store/inventory");
              }}
            >
              <User className="mr-2 h-4 w-4" />
              Escolher no Baralho
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(previewAsset)}
        onOpenChange={(open) => {
          if (!open) setPreviewAsset(null);
        }}
      >
        <DialogContent className="max-h-[96vh] max-w-[96vw] overflow-hidden border-white/10 bg-black/95 p-0 text-white sm:max-w-5xl">
          <DialogHeader className="sr-only">
            <DialogTitle>{previewAsset?.title || "Visualização da imagem"}</DialogTitle>
          </DialogHeader>
          {previewAsset && (
            <div className="relative flex min-h-[58vh] max-h-[92vh] items-center justify-center p-3 sm:p-6">
              <img
                src={previewAsset.src}
                alt={previewAsset.title}
                className={`max-h-[82vh] max-w-full object-contain shadow-2xl ${
                  previewAsset.kind === "avatar" ? "rounded-3xl" : "rounded-2xl"
                }`}
              />
              <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/45 to-transparent px-5 pb-4 pt-16 text-center">
                <p className="text-sm font-semibold sm:text-base">{previewAsset.title}</p>
                <p className="mt-1 text-xs text-white/65">Imagem original em alta definição</p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Profile;
