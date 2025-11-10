import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, Copy, GraduationCap, User as UserIcon, ChevronLeft, ChevronRight } from "lucide-react";
import { getPublicProfile, type PublicProfile as PublicProfileType } from "@/lib/profileEngine";
import { getUserInventory, type InventoryItem, getRarityColor, getRarityLabel } from "@/lib/storeEngine";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { PitecoLogo } from "@/components/PitecoLogo";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export default function PublicProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<PublicProfileType | null>(null);
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [mascotIndex, setMascotIndex] = useState(0);
  const [showAllAvatars, setShowAllAvatars] = useState(false);
  const [showAllMascots, setShowAllMascots] = useState(false);

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
        // Load user's inventory by finding their user_id
        // We need to fetch the actual user_id from profiles table using public_id
        await loadInventory(publicId);
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

  const loadInventory = async (publicId: string) => {
    try {
      // Get userId from profiles table using public_id (user_tag)
      const { data: profileData, error: profileError } = await (await import("@/integrations/supabase/client")).supabase
        .from('profiles')
        .select('id')
        .eq('user_tag', publicId)
        .single();

      if (profileError) throw profileError;
      if (!profileData) return;

      const items = await getUserInventory(profileData.id);
      setInventory(items);
    } catch (error) {
      console.error("Error loading inventory:", error);
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

  const avatares = inventory.filter(item => item.skin?.avatar_final);
  const mascotes = inventory.filter(item => item.skin?.card_final);

  const handlePrevAvatar = () => {
    setAvatarIndex((prev) => (prev > 0 ? prev - 1 : avatares.length - 1));
  };

  const handleNextAvatar = () => {
    setAvatarIndex((prev) => (prev < avatares.length - 1 ? prev + 1 : 0));
  };

  const handlePrevMascot = () => {
    setMascotIndex((prev) => (prev > 0 ? prev - 1 : mascotes.length - 1));
  };

  const handleNextMascot = () => {
    setMascotIndex((prev) => (prev < mascotes.length - 1 ? prev + 1 : 0));
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

        {/* Deck Card */}
        {(avatares.length > 0 || mascotes.length > 0) && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Baralho</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Avatares Section */}
              {avatares.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Avatares ({avatares.length})</h3>
                    {avatares.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllAvatars(true)}
                        className="h-7 text-xs"
                      >
                        Ver todos
                      </Button>
                    )}
                  </div>

                  {avatares.length === 1 ? (
                    <div className="flex justify-center">
                      <div className="relative group w-40">
                        <div className="aspect-square rounded-lg overflow-hidden border-2 border-border bg-card">
                          <img
                            src={avatares[0].skin?.avatar_final}
                            alt={avatares[0].skin?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mt-2 text-center">
                          <p className="text-xs font-medium">{avatares[0].skin?.name}</p>
                          <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(avatares[0].skin?.rarity || 'normal')}`}>
                            {getRarityLabel(avatares[0].skin?.rarity || 'normal')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex justify-center items-center gap-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevAvatar}
                          className="h-8 w-8"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <div className="relative group w-40">
                          <div className="aspect-square rounded-lg overflow-hidden border-2 border-border bg-card">
                            <img
                              src={avatares[avatarIndex]?.skin?.avatar_final}
                              alt={avatares[avatarIndex]?.skin?.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="mt-2 text-center">
                            <p className="text-xs font-medium">{avatares[avatarIndex]?.skin?.name}</p>
                            <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(avatares[avatarIndex]?.skin?.rarity || 'normal')}`}>
                              {getRarityLabel(avatares[avatarIndex]?.skin?.rarity || 'normal')}
                            </Badge>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNextAvatar}
                          className="h-8 w-8"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>

                      <div className="flex justify-center gap-1 mt-3">
                        {avatares.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === avatarIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mascotes Section */}
              {mascotes.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-foreground">Mascotes ({mascotes.length})</h3>
                    {mascotes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowAllMascots(true)}
                        className="h-7 text-xs"
                      >
                        Ver todos
                      </Button>
                    )}
                  </div>

                  {mascotes.length === 1 ? (
                    <div className="flex justify-center">
                      <div className="relative group w-40">
                        <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-border bg-card">
                          <img
                            src={mascotes[0].skin?.card_final}
                            alt={mascotes[0].skin?.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="mt-2 text-center">
                          <p className="text-xs font-medium">{mascotes[0].skin?.name}</p>
                          <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(mascotes[0].skin?.rarity || 'normal')}`}>
                            {getRarityLabel(mascotes[0].skin?.rarity || 'normal')}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="relative">
                      <div className="flex justify-center items-center gap-4">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handlePrevMascot}
                          className="h-8 w-8"
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>

                        <div className="relative group w-40">
                          <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-border bg-card">
                            <img
                              src={mascotes[mascotIndex]?.skin?.card_final}
                              alt={mascotes[mascotIndex]?.skin?.name}
                              className="w-full h-full object-cover"
                            />
                          </div>
                          <div className="mt-2 text-center">
                            <p className="text-xs font-medium">{mascotes[mascotIndex]?.skin?.name}</p>
                            <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(mascotes[mascotIndex]?.skin?.rarity || 'normal')}`}>
                              {getRarityLabel(mascotes[mascotIndex]?.skin?.rarity || 'normal')}
                            </Badge>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={handleNextMascot}
                          className="h-8 w-8"
                        >
                          <ChevronRight className="h-5 w-5" />
                        </Button>
                      </div>

                      <div className="flex justify-center gap-1 mt-3">
                        {mascotes.map((_, idx) => (
                          <div
                            key={idx}
                            className={`h-1.5 rounded-full transition-all ${
                              idx === mascotIndex ? 'w-6 bg-primary' : 'w-1.5 bg-muted'
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

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

      {/* Full Avatares Modal */}
      <Dialog open={showAllAvatars} onOpenChange={setShowAllAvatars}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Todos os Avatares ({avatares.length})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
            {avatares.map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-square rounded-lg overflow-hidden border-2 border-border bg-card">
                  <img
                    src={item.skin?.avatar_final}
                    alt={item.skin?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs font-medium truncate">{item.skin?.name}</p>
                  <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(item.skin?.rarity || 'normal')}`}>
                    {getRarityLabel(item.skin?.rarity || 'normal')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Full Mascots Modal */}
      <Dialog open={showAllMascots} onOpenChange={setShowAllMascots}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Todos os Mascotes ({mascotes.length})</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 p-4">
            {mascotes.map((item) => (
              <div key={item.id} className="relative group">
                <div className="aspect-[3/4] rounded-lg overflow-hidden border-2 border-border bg-card">
                  <img
                    src={item.skin?.card_final}
                    alt={item.skin?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="mt-2 text-center">
                  <p className="text-xs font-medium truncate">{item.skin?.name}</p>
                  <Badge variant="outline" className={`text-xs mt-1 ${getRarityColor(item.skin?.rarity || 'normal')}`}>
                    {getRarityLabel(item.skin?.rarity || 'normal')}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
