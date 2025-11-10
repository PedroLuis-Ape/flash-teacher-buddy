import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PitecoLogo } from "@/components/PitecoLogo";
import { DeckPicker } from "@/components/DeckPicker";
import { getEquippedSkins, getUserInventory, equipSkin, type InventoryItem } from "@/lib/storeEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";
import { getRarityColor, getRarityLabel } from "@/lib/storeEngine";
import { cn } from "@/lib/utils";

export function AppearanceTab() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);
  const [equippedMascot, setEquippedMascot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerMode, setPickerMode] = useState<"avatar" | "mascote">("avatar");

  useEffect(() => {
    loadAppearance();
  }, []);

  const loadAppearance = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      setUserId(session.user.id);

      const [inventoryData, equippedData] = await Promise.all([
        getUserInventory(session.user.id),
        getEquippedSkins(session.user.id),
      ]);

      setInventory(inventoryData);
      setEquippedAvatar(equippedData.avatar_skin_id);
      setEquippedMascot(equippedData.mascot_skin_id);
    } catch (error) {
      console.error('Error loading appearance:', error);
    } finally {
      setLoading(false);
    }
  };

  const openPicker = (mode: "avatar" | "mascote") => {
    setPickerMode(mode);
    setPickerOpen(true);
  };

  const handleEquip = async (skinId: string) => {
    if (!userId) return;

    setEquipping(true);
    try {
      const type = pickerMode === "avatar" ? "avatar" : "mascot";
      console.log(`[AppearanceTab] Equipando ${type}:`, skinId);
      
      // Generate unique operation ID for idempotency
      const operationId = crypto.randomUUID();
      const result = await equipSkin(userId, skinId, type, operationId);
      
      console.log('[AppearanceTab] Equip result:', result);
      
      if (result.success) {
        // Update local state immediately
        if (type === 'avatar') {
          setEquippedAvatar(skinId);
        } else {
          setEquippedMascot(skinId);
        }
        
        // Reload appearance to get fresh data
        await loadAppearance();
        
        // Close picker FIRST
        setPickerOpen(false);
        
        // Then dispatch event to notify Profile page (after modal closes)
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('appearanceChanged'));
        }, 100);
        
        // Show success toast
        toast({
          title: "Sucesso!",
          description: result.message,
        });
      } else {
        // Handle specific error codes
        const errorMessages: Record<string, string> = {
          'NOT_OWNER': 'Você não possui este item.',
          'MISSING_ASSET': 'Este item não tem a mídia necessária.',
          'ALREADY_PROCESSED': 'Esta operação já foi processada.',
          'INVALID_INPUT': 'Dados inválidos.',
          'NOT_FOUND': 'Item não encontrado.',
          'INTERNAL_ERROR': 'Não foi possível ativar. Tente novamente.'
        };
        
        const errorMessage = result.error 
          ? errorMessages[result.error] || result.message
          : result.message;
        
        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive",
        });
        
        // Re-throw to keep picker open
        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('[AppearanceTab] Equip error:', error);
      // Error toast already shown above, just rethrow to keep picker open
      throw error;
    } finally {
      setEquipping(false);
    }
  };

  const getEquippedSkin = (skinId: string | null) => {
    const item = inventory.find(i => i.skin_id === skinId);
    return item?.skin;
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

  const equippedAvatarSkin = getEquippedSkin(equippedAvatar);
  const equippedMascotSkin = getEquippedSkin(equippedMascot);

  return (
    <>
      <div className="p-4 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Aparência</CardTitle>
            <CardDescription>
              Personalize seu perfil e mascote
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Avatar Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">Avatar Atual</h3>
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-muted/30">
                {equippedAvatarSkin ? (
                  <>
                    <img 
                      src={equippedAvatarSkin.avatar_final} 
                      alt="Avatar"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{equippedAvatarSkin.name}</p>
                      <Badge className={cn("text-xs border mt-1", getRarityColor(equippedAvatarSkin.rarity))}>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {getRarityLabel(equippedAvatarSkin.rarity)}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <PitecoLogo className="w-20 h-20" />
                    <div className="flex-1">
                      <p className="font-medium">Nenhum avatar equipado</p>
                      <p className="text-sm text-muted-foreground">Selecione um da sua coleção</p>
                    </div>
                  </>
                )}
              </div>
              
              <Button
                onClick={() => openPicker("avatar")}
                variant="outline"
                className="w-full min-h-[44px]"
                disabled={inventory.length === 0}
              >
                Selecionar um avatar
              </Button>
            </div>

            {/* Mascot Section */}
            <div className="space-y-3">
              <h3 className="font-semibold text-base">Mascote Atual</h3>
              <div className="flex items-center gap-4 p-4 border rounded-xl bg-muted/30">
                {equippedMascotSkin ? (
                  <>
                    <img 
                      src={equippedMascotSkin.card_final} 
                      alt="Mascote"
                      className="w-20 h-28 rounded-lg object-cover"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold truncate">{equippedMascotSkin.name}</p>
                      <Badge className={cn("text-xs border mt-1", getRarityColor(equippedMascotSkin.rarity))}>
                        <Sparkles className="h-3 w-3 mr-1" />
                        {getRarityLabel(equippedMascotSkin.rarity)}
                      </Badge>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="w-20 h-28 bg-muted rounded-lg flex items-center justify-center">
                      <PitecoLogo className="w-16 h-16" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">Nenhum mascote equipado</p>
                      <p className="text-sm text-muted-foreground">Selecione um da sua coleção</p>
                    </div>
                  </>
                )}
              </div>

              <Button
                onClick={() => openPicker("mascote")}
                variant="outline"
                className="w-full min-h-[44px]"
                disabled={inventory.length === 0}
              >
                Selecionar um mascote
              </Button>
            </div>

            {inventory.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Compre pacotes na loja para personalizar sua aparência!
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Deck Picker Modal */}
      <DeckPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        inventory={inventory}
        mode={pickerMode}
        onSelect={handleEquip}
        equipping={equipping}
      />
    </>
  );
}
