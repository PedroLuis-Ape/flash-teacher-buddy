import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeTabs } from "@/components/ape/ApeTabs";
import { AppearanceTab } from "@/components/AppearanceTab";
import { HistoryTab } from "@/components/HistoryTab";
import { StatisticsTab } from "@/components/StatisticsTab";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { LogOut, User, BarChart3, Clock } from "lucide-react";
import { toast } from "sonner";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

const Profile = () => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState("");
  const [email, setEmail] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [mascotUrl, setMascotUrl] = useState("");
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

      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, email, avatar_skin_id, mascot_skin_id")
        .eq("id", session.user.id)
        .maybeSingle();

      if (profile) {
        setFirstName(profile.first_name || "");
        setEmail(profile.email || session.user.email || "");
        
        // Load avatar and mascot from catalog if equipped
        if (profile.avatar_skin_id || profile.mascot_skin_id) {
          const skinIds = [profile.avatar_skin_id, profile.mascot_skin_id].filter(Boolean);
          
          const { data: skins } = await supabase
            .from("public_catalog")
            .select("id, avatar_final, card_final")
            .in("id", skinIds);
          
          if (skins) {
            const avatarSkin = skins.find(s => s.id === profile.avatar_skin_id);
            const mascotSkin = skins.find(s => s.id === profile.mascot_skin_id);
            
            if (avatarSkin) {
              setAvatarUrl(avatarSkin.avatar_final);
            }
            if (mascotSkin) {
              setMascotUrl(mascotSkin.card_final);
            }
          }
        }
      }
    } catch (error) {
      console.error("Error loading profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      sessionStorage.setItem('logoutInProgress', '1');
      await supabase.auth.signOut();
      sessionStorage.removeItem('authReady');
      sessionStorage.removeItem('logoutInProgress');
      toast.success("Logout realizado com sucesso");
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Logout error:", error);
      toast.error("Erro ao fazer logout");
      sessionStorage.removeItem('logoutInProgress');
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
          <Avatar className="h-24 w-24">
            <AvatarImage src={avatarUrl} alt={firstName} />
            <AvatarFallback className="bg-primary text-primary-foreground text-2xl">
              {initials}
            </AvatarFallback>
          </Avatar>
          <div className="space-y-2">
            <h2 className="text-xl font-bold">{firstName || "Usuário"}</h2>
            <p className="text-sm text-muted-foreground">{email}</p>
            
            {/* Mascot badge */}
            {mascotUrl && (
              <div className="flex items-center justify-center gap-2 pt-2">
                <img 
                  src={mascotUrl} 
                  alt="Mascote" 
                  className="w-12 h-16 rounded object-cover"
                />
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="space-y-3">
        <Button
          variant="outline"
          className="w-full justify-start"
          onClick={() => navigate("/folders")}
        >
          <User className="h-4 w-4 mr-2" />
          Editar Perfil
        </Button>

        <Button
          variant="outline"
          className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={handleLogout}
        >
          <LogOut className="h-4 w-4 mr-2" />
          Sair da conta
        </Button>
      </div>
    </div>
  );

  const tabs = [
    { value: "overview", label: "Perfil", content: overviewTab },
  ];

  if (FEATURE_FLAGS.economy_enabled) {
    tabs.push(
      { value: "appearance", label: "Aparência", content: <AppearanceTab /> },
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
