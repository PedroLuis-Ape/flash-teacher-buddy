import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardTitle } from "@/components/ui/card";
import { Check, Loader2, PackageOpen } from "lucide-react";
import { getRarityColor, getRarityLabel, type SkinItem } from "@/lib/storeEngine";
import pitecoinIcon from "@/assets/pitecoin.png";
import { SkinPackageDialog } from "./SkinPackageDialog";

interface SkinCardProps {
  skin: SkinItem;
  owned: boolean;
  onPurchase: (skinId: string, price: number) => Promise<void>;
  onOpenInventory?: () => void;
  loading: boolean;
}

export function SkinCard({
  skin,
  owned,
  onPurchase,
  onOpenInventory,
  loading,
}: SkinCardProps) {
  const [showDetail, setShowDetail] = useState(false);

  const handlePurchase = async () => {
    await onPurchase(skin.id, skin.price_pitecoin);
  };

  const handleOpenInventory = () => {
    setShowDetail(false);
    if (onOpenInventory) {
      onOpenInventory();
      return;
    }
    window.location.assign("/store/inventory");
  };

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        aria-label={`Abrir detalhes de ${skin.name}`}
        className="group h-full cursor-pointer overflow-hidden border transition-[transform,box-shadow,border-color] duration-150 hover:border-primary/40 hover:shadow-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 md:hover:-translate-y-0.5"
        onClick={() => setShowDetail(true)}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            setShowDetail(true);
          }
        }}
      >
        <div className="relative aspect-[7/10] overflow-hidden bg-gradient-to-br from-muted/30 to-muted">
          <img
            src={skin.card_final}
            alt={skin.name}
            loading="lazy"
            decoding="async"
            fetchPriority="low"
            className="h-full w-full object-contain p-1.5 transition-transform duration-200 group-hover:scale-[1.02] sm:p-2"
          />

          <Badge
            variant="outline"
            className={`absolute bottom-2 left-2 max-w-[calc(100%-3rem)] truncate px-2 py-0.5 text-[10px] font-bold shadow-sm sm:text-xs ${getRarityColor(skin.rarity)}`}
          >
            {getRarityLabel(skin.rarity)}
          </Badge>

          {owned && (
            <span
              className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-primary text-primary-foreground shadow-md"
              title="Pacote adquirido"
            >
              <Check className="h-4 w-4" />
              <span className="sr-only">Pacote adquirido</span>
            </span>
          )}
        </div>

        <CardContent className="p-2.5 sm:p-3">
          <CardTitle className="line-clamp-2 min-h-9 text-sm leading-tight sm:text-base">
            {skin.name}
          </CardTitle>
          <p className="mt-1 text-[11px] text-muted-foreground sm:text-xs">Card + foto de perfil</p>

          <div className="mt-2 flex items-center justify-between gap-2 border-t pt-2">
            <div className="flex min-w-0 items-center gap-1.5">
              <img src={pitecoinIcon} alt="PITECOIN" decoding="async" className="h-4 w-4 shrink-0" />
              <span className="truncate text-sm font-bold">
                {skin.price_pitecoin === 0 ? "GRÁTIS" : `₱${skin.price_pitecoin}`}
              </span>
            </div>
            <span className="text-[11px] text-muted-foreground">Ver pacote</span>
          </div>
        </CardContent>
      </Card>

      <SkinPackageDialog
        skin={skin}
        open={showDetail}
        onOpenChange={setShowDetail}
        owned={owned}
        actions={
          owned ? (
            <Button className="h-12 w-full gap-2 sm:w-auto sm:min-w-56" onClick={handleOpenInventory}>
              <PackageOpen className="h-4 w-4" />
              Abrir no inventário
            </Button>
          ) : (
            <Button
              className="h-12 w-full font-bold sm:w-auto sm:min-w-64"
              onClick={handlePurchase}
              disabled={loading}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Processando...
                </>
              ) : skin.price_pitecoin === 0 ? (
                "Obter gratuitamente"
              ) : (
                <span className="flex items-center gap-2">
                  <img src={pitecoinIcon} alt="" className="h-5 w-5" />
                  Comprar por ₱{skin.price_pitecoin}
                </span>
              )}
            </Button>
          )
        }
      />
    </>
  );
}
