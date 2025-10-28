import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getUserInventory, getRarityColor, getRarityLabel, type InventoryItem } from "@/lib/storeEngine";
import { PitecoLogo } from "@/components/PitecoLogo";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

export function InventoryTab() {
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInventory();
  }, []);

  const loadInventory = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const items = await getUserInventory(session.user.id);
      setInventory(items);
    } catch (error) {
      console.error('Error loading inventory:', error);
    } finally {
      setLoading(false);
    }
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
        <CardTitle>Inventário</CardTitle>
        <CardDescription>
          Suas cartas e avatares colecionados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {inventory.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <PitecoLogo className="w-24 h-24 mx-auto opacity-50" />
            <div>
              <p className="text-muted-foreground">
                Você ainda não possui nenhum pacote.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Continue estudando para ganhar PITECOINS e visite a loja!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {inventory.map((item) => (
              <Card key={item.id} className="overflow-hidden">
                <div className="aspect-square bg-muted/50">
                  <img
                    src={item.skin?.card_img}
                    alt={item.skin?.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="font-medium text-sm truncate">{item.skin?.name}</p>
                  <Badge variant="outline" className={getRarityColor(item.skin?.rarity || 'normal')}>
                    {getRarityLabel(item.skin?.rarity || 'normal')}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
