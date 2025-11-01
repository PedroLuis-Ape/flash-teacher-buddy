import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getRarityColor, getRarityLabel, type SkinItem } from "@/lib/storeEngine";
import pitecoinIcon from "@/assets/pitecoin.png";
import { Loader2 } from "lucide-react";

interface SkinCardProps {
  skin: SkinItem;
  owned: boolean;
  onPurchase: (skinId: string, price: number) => Promise<void>;
  loading: boolean;
}

export function SkinCard({ skin, owned, onPurchase, loading }: SkinCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const handlePurchase = async () => {
    await onPurchase(skin.id, skin.price_pitecoin);
    setShowDetail(false);
  };

  return (
    <>
      <Card className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setShowDetail(true)}>
        <CardHeader className="p-0">
          <div className="aspect-square bg-muted relative overflow-hidden">
            <img
              src={skin.card_final}
              alt={skin.name}
              className="w-full h-full object-cover"
            />
            {owned && (
              <div className="absolute top-2 right-2 bg-primary text-primary-foreground px-2 py-1 rounded-md text-xs font-semibold">
                ✓ Possui
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <CardTitle className="text-base line-clamp-1">{skin.name}</CardTitle>
            <Badge variant="outline" className={getRarityColor(skin.rarity)}>
              {getRarityLabel(skin.rarity)}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-sm font-semibold">
            <img src={pitecoinIcon} alt="PITECOIN" className="w-5 h-5" />
            <span>{skin.price_pitecoin === 0 ? 'GRÁTIS' : `₱${skin.price_pitecoin}`}</span>
          </div>
        </CardContent>
      </Card>

      <Dialog open={showDetail} onOpenChange={setShowDetail}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {skin.name}
              <Badge variant="outline" className={getRarityColor(skin.rarity)}>
                {getRarityLabel(skin.rarity)}
              </Badge>
            </DialogTitle>
            <DialogDescription>{skin.description}</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="aspect-square bg-muted rounded-lg overflow-hidden">
              <img
                src={skin.card_final}
                alt={skin.name}
                className="w-full h-full object-cover"
              />
            </div>

            <div className="flex items-center gap-2 text-lg font-semibold">
              <img src={pitecoinIcon} alt="PITECOIN" className="w-6 h-6" />
              <span>{skin.price_pitecoin === 0 ? 'GRÁTIS' : `₱${skin.price_pitecoin}`}</span>
            </div>

            {owned ? (
              <Button className="w-full" disabled>
                ✓ Já possui este pacote
              </Button>
            ) : (
              <Button
                className="w-full"
                onClick={handlePurchase}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  `Comprar por ₱${skin.price_pitecoin}`
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
