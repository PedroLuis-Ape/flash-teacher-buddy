import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { ArrowRightLeft, Loader2, Package, ShoppingBag } from "lucide-react";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { ExchangeTab } from "@/components/ExchangeTab";
import { InventoryTab } from "@/components/InventoryTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SkinCard } from "@/features/store/components/SkinCard";
import { getOfficialPitecoPackages } from "@/lib/officialStoreCatalog";
import { getUserInventory, purchaseSkin, type SkinItem } from "@/lib/storeEngine";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useAuthUser } from "@/hooks/useAuthUser";
import { useEconomy } from "@/contexts/EconomyContext";
import { useToast } from "@/hooks/use-toast";
import pitecoinIcon from "@/assets/pitecoin.png";

export default function Store() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { userId, isLoading: authLoading } = useAuthUser();
  const { balance_pitecoin, refreshBalance, loading: balanceLoading } = useEconomy();
  const [packages, setPackages] = useState<SkinItem[]>([]);
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [buying, setBuying] = useState<string | null>(null);

  useEffect(() => {
    if (!FEATURE_FLAGS.store_visible || authLoading) return;
    if (!userId) return void navigate("/auth", { replace: true });
    setLoading(true);
    Promise.all([getOfficialPitecoPackages(), getUserInventory(userId)])
      .then(([catalog, inventory]) => {
        setPackages(catalog);
        setOwned(new Set(inventory.map(item => item.skin_id)));
      })
      .catch(error => {
        console.error("Error loading store:", error);
        toast({ title: "Erro", description: "Não foi possível carregar a loja.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [authLoading, navigate, toast, userId]);

  const buy = async (skinId: string, price: number) => {
    if (!userId || buying) return;
    setBuying(skinId);
    const result = await purchaseSkin(userId, skinId, price);
    if (result.success) {
      toast({ title: "Compra realizada", description: result.message });
      await refreshBalance();
      const inventory = await getUserInventory(userId);
      setOwned(new Set(inventory.map(item => item.skin_id)));
    } else {
      toast({ title: "Erro na compra", description: result.message, variant: "destructive" });
    }
    setBuying(null);
  };

  if (!FEATURE_FLAGS.store_visible) return <Navigate to="/folders" replace />;

  const path = window.location.pathname;
  const tab = path.includes("/exchange") ? "cambio" : path.includes("/inventory") ? "inventario" : "pacotes";

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Loja do Piteco" showBack backPath="/folders" />
      <Tabs defaultValue={tab}>
        <div className="sticky top-16 z-30 border-b bg-background/95 backdrop-blur">
          <div className="container mx-auto px-3">
            <TabsList className="grid h-12 w-full grid-cols-3">
              <TabsTrigger value="pacotes"><ShoppingBag className="mr-1 h-4 w-4" />Pacotes</TabsTrigger>
              <TabsTrigger value="inventario"><Package className="mr-1 h-4 w-4" />Inventário</TabsTrigger>
              <TabsTrigger value="cambio"><ArrowRightLeft className="mr-1 h-4 w-4" />Câmbio</TabsTrigger>
            </TabsList>
          </div>
        </div>

        <div className="container mx-auto px-4 pt-4">
          <section className="flex items-center justify-between rounded-2xl border bg-card p-3">
            <div>
              <p className="text-xs text-muted-foreground">Seu saldo</p>
              <div className="flex items-center gap-1.5">
                <img src={pitecoinIcon} alt="PITECOIN" className="h-5 w-5" />
                <strong>{balanceLoading ? "..." : new Intl.NumberFormat("pt-BR").format(balance_pitecoin)}</strong>
              </div>
            </div>
            <button className="h-9 rounded-md border px-3 text-sm" onClick={() => navigate("/store/exchange")}>Câmbio</button>
          </section>
        </div>

        <TabsContent value="pacotes">
          <div className="container mx-auto space-y-4 px-4 py-5">
            <div>
              <h2 className="text-lg font-bold">Pacotes disponíveis</h2>
              <p className="text-sm text-muted-foreground">Cada pacote inclui card colecionável e foto de perfil.</p>
            </div>
            {loading || authLoading ? (
              <Loader2 className="mx-auto my-12 h-8 w-8 animate-spin text-primary" />
            ) : !packages.length ? (
              <p className="py-12 text-center text-muted-foreground">Nenhum pacote publicado no momento.</p>
            ) : (
              <ApeGrid cols={{ default: 2, md: 3, lg: 4, xl: 5 }}>
                {packages.map(item => (
                  <SkinCard
                    key={item.id}
                    skin={item}
                    owned={owned.has(item.id)}
                    onPurchase={buy}
                    onOpenInventory={() => navigate("/store/inventory")}
                    loading={buying === item.id}
                  />
                ))}
              </ApeGrid>
            )}
          </div>
        </TabsContent>
        <TabsContent value="inventario"><InventoryTab /></TabsContent>
        <TabsContent value="cambio"><ExchangeTab /></TabsContent>
      </Tabs>
    </div>
  );
}
