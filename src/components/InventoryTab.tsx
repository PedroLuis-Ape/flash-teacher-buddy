import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMockInventory, MOCK_SKINS_CATALOG, type SkinCatalogItem } from "@/lib/economyTypes";
import { PitecoLogo } from "@/components/PitecoLogo";

export function InventoryTab() {
  const inventory = getMockInventory();

  // Map inventory items to catalog items
  const ownedSkins = inventory
    .map(item => MOCK_SKINS_CATALOG.find(skin => skin.id === item.skin_id))
    .filter((skin): skin is SkinCatalogItem => skin !== undefined);

  const getRarityColor = (rarity: string) => {
    switch (rarity) {
      case 'legendary': return 'bg-yellow-500/10 text-yellow-500 border-yellow-500/20';
      case 'epic': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'rare': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Inventário</CardTitle>
        <CardDescription>
          Seus pacotes e skins coletados
        </CardDescription>
      </CardHeader>
      <CardContent>
        {ownedSkins.length === 0 ? (
          <div className="text-center py-12 space-y-4">
            <PitecoLogo className="w-24 h-24 mx-auto opacity-50" />
            <div>
              <p className="text-muted-foreground">
                Você ainda não possui nenhum pacote.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Continue estudando para desbloquear!
              </p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {ownedSkins.map((skin) => (
              <Card key={skin.id} className="overflow-hidden">
                <div className="aspect-square bg-muted/50 flex items-center justify-center p-4">
                  <PitecoLogo className="w-full h-full" />
                </div>
                <CardContent className="p-3 space-y-2">
                  <p className="font-medium text-sm truncate">{skin.name}</p>
                  <Badge variant="outline" className={getRarityColor(skin.rarity)}>
                    {skin.rarity}
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
