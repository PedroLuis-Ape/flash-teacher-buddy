import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { getUserInventory, type InventoryItem, getRarityColor, getRarityLabel } from "@/lib/storeEngine";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function DeckTab() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewAllOpen, setViewAllOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"avatares" | "mascotes">("avatares");
  const [avatarIndex, setAvatarIndex] = useState(0);
  const [mascotIndex, setMascotIndex] = useState(0);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const inventoryData = await getUserInventory(session.user.id);
      setInventory(inventoryData);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  const avatares = inventory.filter(item => item.skin?.avatar_final);
  const mascotes = inventory.filter(item => item.skin?.card_final);

  const handlePrevAvatar = () => {
    setAvatarIndex((prev) => (prev === 0 ? avatares.length - 1 : prev - 1));
  };

  const handleNextAvatar = () => {
    setAvatarIndex((prev) => (prev === avatares.length - 1 ? 0 : prev + 1));
  };

  const handlePrevMascot = () => {
    setMascotIndex((prev) => (prev === 0 ? mascotes.length - 1 : prev - 1));
  };

  const handleNextMascot = () => {
    setMascotIndex((prev) => (prev === mascotes.length - 1 ? 0 : prev + 1));
  };

  const openViewAll = (mode: "avatares" | "mascotes") => {
    setViewMode(mode);
    setViewAllOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  const currentAvatar = avatares[avatarIndex];
  const currentMascot = mascotes[mascotIndex];

  return (
    <>
      <div className="p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Baralho</CardTitle>
            <CardDescription>
              Sua coleção de avatares e mascotes
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatares Carousel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Avatares</h3>
                <span className="text-sm text-muted-foreground">
                  {avatares.length} {avatares.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {avatares.length > 0 ? (
                <div className="relative">
                  <div className="flex items-center gap-4 p-6 border rounded-xl bg-muted/30">
                    {avatares.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevAvatar}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                    )}

                    <div className="flex-1 flex flex-col items-center gap-3 animate-fade-in">
                      <img 
                        src={currentAvatar.skin!.avatar_final} 
                        alt={currentAvatar.skin!.name}
                        className="w-32 h-32 rounded-full object-cover"
                      />
                      <div className="text-center">
                        <p className="font-semibold">{currentAvatar.skin!.name}</p>
                        <Badge className={cn("text-xs border mt-1", getRarityColor(currentAvatar.skin!.rarity))}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          {getRarityLabel(currentAvatar.skin!.rarity)}
                        </Badge>
                      </div>
                    </div>

                    {avatares.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextAvatar}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    )}
                  </div>
                  
                  {avatares.length > 1 && (
                    <div className="flex justify-center gap-1 mt-3">
                      {avatares.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            idx === avatarIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-xl bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Nenhum avatar na sua coleção ainda
                  </p>
                </div>
              )}

              {avatares.length > 0 && (
                <Button
                  onClick={() => openViewAll("avatares")}
                  variant="outline"
                  className="w-full"
                >
                  Ver todos os avatares
                </Button>
              )}
            </div>

            {/* Mascotes Carousel */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-base">Mascotes</h3>
                <span className="text-sm text-muted-foreground">
                  {mascotes.length} {mascotes.length === 1 ? 'item' : 'itens'}
                </span>
              </div>

              {mascotes.length > 0 ? (
                <div className="relative">
                  <div className="flex items-center gap-4 p-6 border rounded-xl bg-muted/30">
                    {mascotes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handlePrevMascot}
                        className="absolute left-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </Button>
                    )}

                    <div className="flex-1 flex flex-col items-center gap-3 animate-fade-in">
                      <img 
                        src={currentMascot.skin!.card_final} 
                        alt={currentMascot.skin!.name}
                        className="w-40 h-56 rounded-lg object-cover"
                      />
                      <div className="text-center">
                        <p className="font-semibold">{currentMascot.skin!.name}</p>
                        <Badge className={cn("text-xs border mt-1", getRarityColor(currentMascot.skin!.rarity))}>
                          <Sparkles className="h-3 w-3 mr-1" />
                          {getRarityLabel(currentMascot.skin!.rarity)}
                        </Badge>
                      </div>
                    </div>

                    {mascotes.length > 1 && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleNextMascot}
                        className="absolute right-2 top-1/2 -translate-y-1/2 z-10 h-8 w-8"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </Button>
                    )}
                  </div>

                  {mascotes.length > 1 && (
                    <div className="flex justify-center gap-1 mt-3">
                      {mascotes.map((_, idx) => (
                        <div
                          key={idx}
                          className={cn(
                            "h-1.5 rounded-full transition-all",
                            idx === mascotIndex ? "w-6 bg-primary" : "w-1.5 bg-muted-foreground/30"
                          )}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-8 text-center border rounded-xl bg-muted/20">
                  <p className="text-sm text-muted-foreground">
                    Nenhum mascote na sua coleção ainda
                  </p>
                </div>
              )}

              {mascotes.length > 0 && (
                <Button
                  onClick={() => openViewAll("mascotes")}
                  variant="outline"
                  className="w-full"
                >
                  Ver todos os mascotes
                </Button>
              )}
            </div>

            {inventory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Compre pacotes na loja para começar sua coleção!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* View All Modal */}
      <Dialog open={viewAllOpen} onOpenChange={setViewAllOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {viewMode === "avatares" ? "Todos os Avatares" : "Todos os Mascotes"}
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mt-4">
            {(viewMode === "avatares" ? avatares : mascotes).map((item) => (
              <div
                key={item.id}
                className="p-4 rounded-xl border bg-card text-center space-y-2"
              >
                <div className={cn(
                  "overflow-hidden mx-auto bg-muted",
                  viewMode === "avatares" 
                    ? "w-24 h-24 rounded-full" 
                    : "w-24 h-32 rounded-lg"
                )}>
                  <img
                    src={viewMode === "avatares" ? item.skin!.avatar_final : item.skin!.card_final}
                    alt={item.skin!.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <p className="text-sm font-medium truncate">{item.skin!.name}</p>
                <Badge className={cn("text-xs border", getRarityColor(item.skin!.rarity))}>
                  <Sparkles className="h-3 w-3 mr-1" />
                  {getRarityLabel(item.skin!.rarity)}
                </Badge>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
