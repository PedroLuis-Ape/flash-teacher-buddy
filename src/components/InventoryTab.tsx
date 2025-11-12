import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, Check } from "lucide-react";
import { toast } from "sonner";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { getUserInventory, equipSkin, getEquippedSkins, type InventoryItem } from "@/lib/storeEngine";

// Extended inventory item with enriched data
interface EnrichedInventoryItem extends InventoryItem {
  name: string;
  rarity: string;
  card_url: string;
  avatar_url: string;
}

export function InventoryTab() {
  const [inventory, setInventory] = useState<EnrichedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState<string | null>(null);
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);
  const [equippedMascot, setEquippedMascot] = useState<string | null>(null);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const [items, equipped] = await Promise.all([
        getUserInventory(session.user.id),
        getEquippedSkins(session.user.id)
      ]);

      // Enrich inventory items with skin details
      const enrichedItems = items.map(item => ({
        ...item,
        name: item.skin?.name || 'Desconhecido',
        rarity: item.skin?.rarity || 'normal',
        card_url: item.skin?.card_final || '',
        avatar_url: item.skin?.avatar_final || ''
      }));

      setInventory(enrichedItems);
      setEquippedAvatar(equipped.avatar_skin_id);
      setEquippedMascot(equipped.mascot_skin_id);
    } catch (error) {
      console.error("Error loading inventory:", error);
      toast.error("Erro ao carregar inventário");
    } finally {
      setLoading(false);
    }
  };

  const handleEquip = async (skinId: string, type: 'avatar' | 'mascot') => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;

    setEquipping(skinId);
    try {
      const operationId = crypto.randomUUID();
      const result = await equipSkin(session.user.id, skinId, type, operationId);

      if (result.success) {
        toast.success(result.message || `${type === 'avatar' ? 'Avatar' : 'Mascote'} equipado!`);
        
        // Update local state
        if (type === 'avatar') {
          setEquippedAvatar(skinId);
        } else {
          setEquippedMascot(skinId);
        }
      } else {
        toast.error(result.message || "Erro ao equipar");
      }
    } catch (error) {
      console.error("Error equipping:", error);
      toast.error("Erro ao equipar item");
    } finally {
      setEquipping(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (inventory.length === 0) {
    return (
      <div className="container mx-auto px-4 py-6">
        <Card>
          <CardHeader>
            <CardTitle>Inventário Vazio</CardTitle>
          </CardHeader>
          <CardContent className="py-8 text-center text-muted-foreground">
            <p>Você ainda não possui nenhum pacote</p>
            <p className="text-sm mt-2">Visite a aba Pacotes para começar sua coleção!</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-6">
      {/* Equipped Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Equipados Atualmente</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Avatar</p>
              <p className="text-sm font-medium">
                {equippedAvatar ? inventory.find(i => i.skin_id === equippedAvatar)?.name || 'Equipado' : 'Nenhum'}
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">Mascote</p>
              <p className="text-sm font-medium">
                {equippedMascot ? inventory.find(i => i.skin_id === equippedMascot)?.name || 'Equipado' : 'Nenhum'}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Inventory Grid */}
      <ApeGrid cols={{ default: 2, md: 3, lg: 4 }}>
        {inventory.map((item) => {
          const isAvatarEquipped = equippedAvatar === item.skin_id;
          const isMascotEquipped = equippedMascot === item.skin_id;
          const isEquipping = equipping === item.skin_id;

          return (
            <Card key={item.id} className="overflow-hidden">
              <div className="aspect-[4/3] relative overflow-hidden bg-gradient-to-br from-primary/10 to-secondary/10">
                {item.card_url && (
                  <img 
                    src={item.card_url} 
                    alt={item.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <CardContent className="p-3 space-y-2">
                <div>
                  <h3 className="font-semibold text-sm line-clamp-1">{item.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize">{item.rarity}</p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant={isAvatarEquipped ? "default" : "outline"}
                    className="flex-1 h-9"
                    onClick={() => handleEquip(item.skin_id, 'avatar')}
                    disabled={isEquipping || isAvatarEquipped}
                  >
                    {isEquipping ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isAvatarEquipped ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Avatar
                      </>
                    ) : (
                      "Avatar"
                    )}
                  </Button>
                  
                  <Button
                    size="sm"
                    variant={isMascotEquipped ? "default" : "outline"}
                    className="flex-1 h-9"
                    onClick={() => handleEquip(item.skin_id, 'mascot')}
                    disabled={isEquipping || isMascotEquipped}
                  >
                    {isEquipping ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : isMascotEquipped ? (
                      <>
                        <Check className="h-3 w-3 mr-1" />
                        Mascote
                      </>
                    ) : (
                      "Mascote"
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </ApeGrid>
    </div>
  );
}
