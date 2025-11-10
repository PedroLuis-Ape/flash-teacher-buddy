import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Copy, GraduationCap, User as UserIcon } from "lucide-react";
import { getPublicProfile, type PublicProfile as PublicProfileType } from "@/lib/profileEngine";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PitecoLogo } from "@/components/PitecoLogo";
import pitecoinIcon from "@/assets/pitecoin.png";

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadProfile(id);
    }
  }, [id]);

  const loadProfile = async (publicId: string) => {
    setLoading(true);
    try {
      const result = await getPublicProfile(publicId);
      
      if (result.success && result.profile) {
        setProfile(result.profile);
      } else {
        toast.error(result.message || "Usuário não encontrado.");
        navigate("/");
      }
    } catch (error) {
      console.error("Error loading public profile:", error);
      toast.error("Erro ao carregar perfil.");
      navigate("/");
    } finally {
      setLoading(false);
    }
  };

  const handleCopyId = () => {
    if (profile?.public_id) {
      navigator.clipboard.writeText(profile.public_id);
      toast.success("ID copiado!");
    }
  };

  const getUserTypeLabel = (type: string) => {
    return type === 'professor' ? 'Professor' : 'Aluno';
  };

  const getUserTypeIcon = (type: string) => {
    return type === 'professor' ? GraduationCap : UserIcon;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <ApeAppBar title="Perfil Público" />
        <div className="flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return null;
  }

  const initials = profile.name
    ? profile.name.split(" ").map(n => n[0]).slice(0, 2).join("").toUpperCase()
    : "?";

  const TypeIcon = getUserTypeIcon(profile.user_type);

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Perfil Público" />
      
      <div className="container max-w-2xl mx-auto p-4 space-y-4">
        {/* Header Card */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col items-center text-center space-y-4">
              {/* Avatar */}
              <Avatar className="h-32 w-32 border-4 border-primary/20">
                <AvatarImage src={profile.avatar?.url} alt={profile.name} />
                <AvatarFallback className="text-2xl">
                  {profile.avatar ? <img src={profile.avatar.url} alt="" /> : initials}
                </AvatarFallback>
              </Avatar>

              {/* Name and Type */}
              <div className="space-y-2">
                <h1 className="text-2xl font-bold">{profile.name || "Sem nome"}</h1>
                
                <div className="flex items-center justify-center gap-2 flex-wrap">
                  <Badge variant="outline" className="gap-1">
                    <TypeIcon className="h-3 w-3" />
                    {getUserTypeLabel(profile.user_type)}
                  </Badge>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleCopyId}
                    className="h-7 gap-1 text-xs"
                  >
                    <span className="font-mono">{profile.public_id}</span>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Mascot */}
              {profile.mascot && (
                <div className="mt-4">
                  <img
                    src={profile.mascot.url}
                    alt={profile.mascot.name}
                    className="h-32 w-24 object-cover rounded-lg border-2 border-border"
                  />
                  <p className="text-xs text-muted-foreground mt-1">{profile.mascot.name}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Estatísticas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Listas criadas</p>
                <p className="text-2xl font-bold">{profile.stats.lists_created}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">Cartões estudados</p>
                <p className="text-2xl font-bold">{profile.stats.cards_studied}</p>
              </div>
              
              <div className="space-y-1">
                <p className="text-sm text-muted-foreground">PTS Semanal</p>
                <p className="text-2xl font-bold">{profile.stats.points}</p>
              </div>
              
              <div className="space-y-1 flex items-center gap-2">
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">PITECOIN</p>
                  <p className="text-2xl font-bold flex items-center gap-1">
                    <img src={pitecoinIcon} alt="₱" className="h-5 w-5" />
                    {profile.stats.ptc}
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            onClick={() => navigate(-1)}
            variant="outline"
            className="flex-1 min-h-[44px]"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
        </div>
      </div>
    </div>
  );
}
