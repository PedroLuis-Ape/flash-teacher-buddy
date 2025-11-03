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
      <Card className="overflow-hidden hover:shadow-xl hover:scale-[1.02] transition-all duration-300 cursor-pointer border-2" onClick={() => setShowDetail(true)}>
        <CardHeader className="p-0">
          <div className="aspect-[3/4] bg-gradient-to-br from-muted/50 to-muted relative overflow-hidden">
            <img
              src={skin.card_final}
              alt={skin.name}
              className="w-full h-full object-contain p-2"
            />
            {owned && (
              <div className="absolute top-3 right-3 bg-primary text-primary-foreground px-3 py-1.5 rounded-full text-xs font-bold shadow-lg">
                ✓ Possui
              </div>
            )}
            <Badge 
              variant="outline" 
              className={`absolute top-3 left-3 ${getRarityColor(skin.rarity)} font-bold shadow-md`}
            >
              {getRarityLabel(skin.rarity)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-4 space-y-3">
          <CardTitle className="text-lg line-clamp-2 min-h-[3.5rem] flex items-center">
            {skin.name}
          </CardTitle>
          <div className="flex items-center justify-between gap-2 pt-2 border-t">
            <div className="flex items-center gap-2">
              <img src={pitecoinIcon} alt="PITECOIN" className="w-6 h-6" />
              <span className="text-lg font-bold">
                {skin.price_pitecoin === 0 ? 'GRÁTIS' : `₱${skin.price_pitecoin}`}
              </span>
            </div>
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

          <div className="space-y-6">
            <div className="aspect-[3/4] bg-gradient-to-br from-muted/30 to-muted rounded-xl overflow-hidden border-2">
              <img
                src={skin.card_final}
                alt={skin.name}
                className="w-full h-full object-contain p-4"
              />
            </div>

            <div className="flex items-center justify-center gap-3 text-2xl font-bold bg-muted/30 rounded-lg p-4">
              <img src={pitecoinIcon} alt="PITECOIN" className="w-8 h-8" />
              <span>{skin.price_pitecoin === 0 ? 'GRÁTIS' : `₱${skin.price_pitecoin}`}</span>
            </div>

            {owned ? (
              <Button className="w-full py-6 text-lg" disabled>
                ✓ Já possui este pacote
              </Button>
            ) : (
              <Button
                className="w-full py-6 text-lg font-bold"
                onClick={handlePurchase}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Processando...
                  </>
                ) : (
                  skin.price_pitecoin === 0 ? 'Obter Gratuitamente' : `Comprar por ₱${skin.price_pitecoin}`
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
