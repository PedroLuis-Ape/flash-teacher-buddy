import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeTabs } from "@/components/ape/ApeTabs";
import { DeckTab } from "@/components/DeckTab";
import { HistoryTab } from "@/components/HistoryTab";
import { StatisticsTab } from "@/components/StatisticsTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, BarChart3, Clock, Copy } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

const Profile = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [publicId, setPublicId] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [mascotUrl, setMascotUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate("/auth");
        return;
      }

      console.log('[Profile] Loading profile for user:', session.user.id);

      // Force fresh data from server (no cache)
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("first_name, email, user_tag, avatar_skin_id, mascot_skin_id, avatar_url")
        .eq("id", session.user.id)
        .single();

      if (profileError) {
        console.error('[Profile] Error loading profile:', profileError);
        return;
      }

      console.log('[Profile] Profile data:', profile);

      if (profile) {
        setFirstName(profile.first_name || "");
        setEmail(profile.email || session.user.email || "");
        
        // Initialize public ID if needed
        if (!profile.user_tag || !profile.user_tag.match(/^[PA][0-9]{6}$/)) {
          const { initPublicId } = await import("@/lib/profileEngine");
          const result = await initPublicId(session.user.id);
          if (result.success && result.publicId) {
            setPublicId(result.publicId);
          }
        } else {
          setPublicId(profile.user_tag);
        }

        // Load avatar from profile (priority: avatar_url, then avatar_skin_id)
        if (profile.avatar_url) {
          setAvatarUrl(profile.avatar_url);
        } else if (profile.avatar_skin_id) {
          const { data: avatarData } = await supabase
            .from("public_catalog")
            .select("avatar_final")
            .eq("id", profile.avatar_skin_id)
            .single();
          
          if (avatarData?.avatar_final) {
            setAvatarUrl(avatarData.avatar_final);
          }
        }

        // Load mascot
        if (profile.mascot_skin_id) {
          const { data: mascotData } = await supabase
            .from("public_catalog")
            .select("card_final")
            .eq("id", profile.mascot_skin_id)
            .single();
          
          if (mascotData?.card_final) {
            setMascotUrl(mascotData.card_final);
          }
        }
      }
    } catch (error) {
      console.error("[Profile] Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    try {
      setIsLoggingOut(true);
      sessionStorage.setItem('logoutInProgress', '1');
      await supabase.auth.signOut();
      sessionStorage.removeItem('authReady');
      sessionStorage.removeItem('logoutInProgress');
      toast.success("✅ Logout realizado com sucesso");
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("❌ Erro ao fazer logout");
      sessionStorage.removeItem('logoutInProgress');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleCopyId = () => {
    if (publicId) {
      navigator.clipboard.writeText(publicId);
      toast.success("ID copiado!");
    }
  };

  const initials = firstName
    ? firstName.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  // Profile overview tab
  const overviewTab = (
    <div className="p-4 space-y-6">
      <Card className="p-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <Avatar className="h-24 w-24 ring-2 ring-primary/20">
            {avatarUrl ? (
              <AvatarImage 
                src={avatarUrl} 
                alt="Avatar" 
                className="object-cover"
              />
            ) : null}
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{firstName || "Usuário"}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            {publicId && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopyId}
                className="h-8 gap-2 mt-2"
              >
                <span className="font-mono text-sm">{publicId}</span>
                <Copy className="h-3 w-3" />
              </Button>
            )}
          </div>
        </div>

        {/* Mascot Display */}
        {mascotUrl && (
          <div className="mt-6 pt-6 border-t">
            <p className="text-sm text-muted-foreground mb-3 text-center">Mascote Equipado</p>
            <div className="aspect-[4/3] relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 to-secondary/10">
              <img 
                src={mascotUrl} 
                alt="Mascote"
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        )}
      </Card>

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start min-h-[44px]"
          onClick={() => navigate("/folders")}
        >
          <User className="h-4 w-4 mr-2" />
          Editar Perfil
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 min-h-[44px]"
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {isLoggingOut ? 'Saindo...' : 'Sair da conta'}
        </Button>
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
      { value: "statistics", label: "Estatísticas", content: <StatisticsTab /> }
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
    </div>
  );
};

export default Profile;
