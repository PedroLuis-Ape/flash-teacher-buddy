import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { getEquippedSkins, getUserInventory, equipSkin, type InventoryItem, type SkinItem } from "@/lib/storeEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function AppearanceTab() {
  const { toast } = useToast();
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [equippedAvatar, setEquippedAvatar] = useState<string | null>(null);
  const [equippedMascot, setEquippedMascot] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [equipping, setEquipping] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

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

  const handleEquip = async (skinId: string, type: 'avatar' | 'mascot') => {
    if (!userId) return;

    setEquipping(true);
    try {
      const result = await equipSkin(userId, skinId, type);
      
      if (result.success) {
        toast({
          title: "Sucesso!",
          description: result.message,
        });
        if (type === 'avatar') {
          setEquippedAvatar(skinId);
        } else {
          setEquippedMascot(skinId);
        }
      } else {
        toast({
          title: "Erro",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('Equip error:', error);
      toast({
        title: "Erro",
        description: "Não foi possível equipar o item.",
        variant: "destructive",
      });
    } finally {
      setEquipping(false);
    }
  };

  const getEquippedSkin = (skinId: string | null): SkinItem | undefined => {
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

  return (
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
          <h3 className="font-semibold flex items-center gap-2">
            Avatar Atual
          </h3>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
            {equippedAvatar ? (
              <>
                <img 
                  src={getEquippedSkin(equippedAvatar)?.avatar_final} 
                  alt="Avatar"
                  className="w-16 h-16 rounded-full object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium">{getEquippedSkin(equippedAvatar)?.name}</p>
                  <p className="text-sm text-muted-foreground">Avatar equipado</p>
                </div>
              </>
            ) : (
              <>
                <PitecoLogo className="w-16 h-16" />
                <div className="flex-1">
                  <p className="font-medium">Nenhum avatar equipado</p>
                  <p className="text-sm text-muted-foreground">Selecione um abaixo</p>
                </div>
              </>
            )}
          </div>
          
          {inventory.length > 0 && (
            <Select
              value={equippedAvatar || ''}
              onValueChange={(value) => handleEquip(value, 'avatar')}
              disabled={equipping}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um avatar" />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.skin_id}>
                    {item.skin?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {/* Mascot Section */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            Mascote Atual
          </h3>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
            {equippedMascot ? (
              <>
                <img 
                  src={getEquippedSkin(equippedMascot)?.card_final} 
                  alt="Mascote"
                  className="w-16 h-16 rounded-lg object-cover"
                />
                <div className="flex-1">
                  <p className="font-medium">{getEquippedSkin(equippedMascot)?.name}</p>
                  <p className="text-sm text-muted-foreground">Card equipado</p>
                </div>
              </>
            ) : (
              <>
                <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                  <PitecoLogo className="w-12 h-12" />
                </div>
                <div className="flex-1">
                  <p className="font-medium">Nenhum mascote equipado</p>
                  <p className="text-sm text-muted-foreground">Selecione um abaixo</p>
                </div>
              </>
            )}
          </div>

          {inventory.length > 0 && (
            <Select
              value={equippedMascot || ''}
              onValueChange={(value) => handleEquip(value, 'mascot')}
              disabled={equipping}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um mascote" />
              </SelectTrigger>
              <SelectContent>
                {inventory.map((item) => (
                  <SelectItem key={item.id} value={item.skin_id}>
                    {item.skin?.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>

        {inventory.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            Compre pacotes na loja para personalizar sua aparência!
          </p>
        )}
      </CardContent>
    </Card>
  );
}
