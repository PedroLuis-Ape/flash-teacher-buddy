import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { getMockAppearance, MOCK_SKINS_CATALOG } from "@/lib/economyTypes";
import { Info } from "lucide-react";

export function AppearanceTab() {
  const appearance = getMockAppearance();

  const avatarSkin = MOCK_SKINS_CATALOG.find(s => s.id === appearance.avatar_skin_id);
  const mascotSkin = MOCK_SKINS_CATALOG.find(s => s.id === appearance.mascot_skin_id);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Aparência</CardTitle>
        <CardDescription>
          Personalize seu avatar e mascote
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Avatar Section */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            Avatar Atual
          </h3>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center overflow-hidden">
              <PitecoLogo className="w-16 h-16" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{avatarSkin?.name || "Piteco Prime"}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {avatarSkin?.rarity || "normal"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Função de troca disponível em breve.</p>
          </div>
        </div>

        {/* Mascot Section */}
        <div className="space-y-3">
          <h3 className="font-semibold flex items-center gap-2">
            Mascote Atual
          </h3>
          <div className="flex items-center gap-4 p-4 border rounded-lg bg-muted/30">
            <div className="w-20 h-20 rounded bg-muted flex items-center justify-center overflow-hidden">
              <PitecoLogo className="w-16 h-16" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{mascotSkin?.name || "Piteco Prime"}</p>
              <p className="text-sm text-muted-foreground capitalize">
                {mascotSkin?.rarity || "normal"}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm text-muted-foreground bg-muted/20 p-3 rounded-md">
            <Info className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <p>Função de troca disponível em breve.</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
