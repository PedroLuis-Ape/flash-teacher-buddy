import { useCallback, useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { SkinCard } from "@/features/store/components/SkinCard";
import { ExchangeTab } from "@/components/ExchangeTab";
import { InventoryTab } from "@/components/InventoryTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSkinsCaltalog, getUserInventory, purchaseSkin, type SkinItem } from "@/lib/storeEngine";
import { useToast } from "@/hooks/use-toast";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useEconomy } from "@/contexts/EconomyContext";
import { useAuthUser } from "@/hooks/useAuthUser";
import { Loader2, ShoppingBag, ArrowRightLeft, Package } from "lucide-react";
import pitecoinIcon from "@/assets/pitecoin.png";

const Store = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { balance_pitecoin, refreshBalance, loading: balanceLoading } = useEconomy();
  const { userId, isLoading: authLoading } = useAuthUser();
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [ownedSkinIds, setOwnedSkinIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [purchasingItems, setPurchasingItems] = useState<Set<string>>(new Set());

  const loadStoreData = useCallback(async (activeUserId: string) => {
    setLoading(true);
    try {
      const [catalogData, inventoryData] = await Promise.all([
        getSkinsCaltalog(),
        getUserInventory(activeUserId),
      ]);

      setSkins(catalogData);
      setOwnedSkinIds(new Set(inventoryData.map(item => item.skin_id)));
    } catch (error) {
      console.error("Error loading store:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a loja.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!FEATURE_FLAGS.store_visible || authLoading) return;
    if (!userId) {
      navigate("/auth", { replace: true });
      return;
    }
    void loadStoreData(userId);
  }, [authLoading, loadStoreData, navigate, userId]);

  const handlePurchase = async (skinId: string, price: number) => {
    if (!userId || purchasingItems.has(skinId)) return;

    setPurchasingItems(prev => new Set(prev).add(skinId));

    try {
      const result = await purchaseSkin(userId, skinId, price);

      if (result.success) {
        toast({
          title: "✅ Compra realizada!",
          description: result.message,
        });
        await refreshBalance();
        const inventoryData = await getUserInventory(userId);
        setOwnedSkinIds(new Set(inventoryData.map(item => item.skin_id)));
      } else {
        toast({
          title: "❌ Erro na compra",
          description: result.message,
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Purchase error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível processar a compra.",
        variant: "destructive",
      });
    } finally {
      setPurchasingItems(prev => {
        const next = new Set(prev);
        next.delete(skinId);
        return next;
      });
    }
  };

  if (!FEATURE_FLAGS.store_visible) {
    return <Navigate to="/folders" replace />;
  }

  const location = window.location.pathname;
  const initialTab = location.includes("/exchange") ? "cambio" :
                     location.includes("/inventory") ? "inventario" : "pacotes";

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Loja do Piteco" showBack backPath="/folders" />

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="border-b bg-background/95 backdrop-blur sticky top-16 z-30">
          <div className="container mx-auto px-3 sm:px-4">
            <TabsList className="w-full grid grid-cols-3 h-12">
              <TabsTrigger value="pacotes" className="gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm">
                <ShoppingBag className="h-4 w-4" />
                Pacotes
              </TabsTrigger>
              <TabsTrigger value="inventario" className="gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm">
                <Package className="h-4 w-4" />
                Inventário
              </TabsTrigger>
              <TabsTrigger value="cambio" className="gap-1.5 px-2 text-xs sm:gap-2 sm:text-sm">
                <ArrowRightLeft className="h-4 w-4" />
                Câmbio
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="pacotes" className="mt-0">
          <div className="container mx-auto px-4 py-5 space-y-4">
            <section className="flex items-center justify-between gap-3 rounded-2xl border bg-card p-3 shadow-sm">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Seu saldo</p>
                <div className="flex items-center gap-1.5">
                  <img src={pitecoinIcon} alt="PITECOIN" className="h-5 w-5" />
                  <strong className="truncate text-lg tabular-nums">
                    {balanceLoading ? "..." : new Intl.NumberFormat("pt-BR").format(balance_pitecoin)}
                  </strong>
                </div>
              </div>
              <button
                type="button"
                className="h-9 shrink-0 rounded-md border bg-background px-3 text-sm font-medium"
                onClick={() => navigate("/store/exchange")}
              >
                Câmbio
              </button>
            </section>

            <div>
              <h2 className="text-lg font-bold">Pacotes disponíveis</h2>
              <p className="text-sm text-muted-foreground">
                Toque em um card para abrir o pacote completo.
              </p>
            </div>

            {loading || authLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : skins.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum pacote publicado no momento.</p>
              </div>
            ) : (
              <ApeGrid cols={{ default: 2, md: 3, lg: 4, xl: 5 }}>
                {skins.map((skin) => (
                  <SkinCard
                    key={skin.id}
                    skin={skin}
                    owned={ownedSkinIds.has(skin.id)}
                    onPurchase={handlePurchase}
                    onOpenInventory={() => navigate("/store/inventory")}
                    loading={purchasingItems.has(skin.id)}
                  />
                ))}
              </ApeGrid>
            )}
          </div>
        </TabsContent>

        <TabsContent value="inventario" className="mt-0">
          <InventoryTab />
        </TabsContent>

        <TabsContent value="cambio" className="mt-0">
          <ExchangeTab />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Store;
