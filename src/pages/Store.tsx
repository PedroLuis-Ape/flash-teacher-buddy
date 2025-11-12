import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { ApeGrid } from "@/components/ape/ApeGrid";
import { SkinCard } from "@/components/SkinCard";
import { ExchangeTab } from "@/components/ExchangeTab";
import { InventoryTab } from "@/components/InventoryTab";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getSkinsCaltalog, getUserInventory, purchaseSkin, type SkinItem } from "@/lib/storeEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { useEconomy } from "@/contexts/EconomyContext";
import { Loader2, ShoppingBag, ArrowRightLeft, Package } from "lucide-react";

const Store = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { refreshBalance } = useEconomy();
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [ownedSkinIds, setOwnedSkinIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [purchasingItems, setPurchasingItems] = useState<Set<string>>(new Set());
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadStoreData();
  }, []);

  const loadStoreData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        navigate('/auth');
        return;
      }

      setUserId(session.user.id);

      const [catalogData, inventoryData] = await Promise.all([
        getSkinsCaltalog(),
        getUserInventory(session.user.id),
      ]);

      setSkins(catalogData);
      setOwnedSkinIds(new Set(inventoryData.map(item => item.skin_id)));
    } catch (error) {
      console.error('Error loading store:', error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar a loja.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

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
      console.error('Purchase error:', error);
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
    navigate('/folders');
    return null;
  }

  // Detect initial tab from URL
  const location = window.location.pathname;
  const initialTab = location.includes('/exchange') ? 'cambio' : 
                     location.includes('/inventory') ? 'inventario' : 'pacotes';

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Loja do Piteco" showBack backPath="/folders" />

      <Tabs defaultValue={initialTab} className="w-full">
        <div className="border-b bg-background/95 backdrop-blur sticky top-16 z-30">
          <div className="container mx-auto px-4">
            <TabsList className="w-full grid grid-cols-3 h-12">
              <TabsTrigger value="pacotes" className="gap-2">
                <ShoppingBag className="h-4 w-4" />
                Pacotes
              </TabsTrigger>
              <TabsTrigger value="inventario" className="gap-2">
                <Package className="h-4 w-4" />
                Inventário
              </TabsTrigger>
              <TabsTrigger value="cambio" className="gap-2">
                <ArrowRightLeft className="h-4 w-4" />
                Câmbio
              </TabsTrigger>
            </TabsList>
          </div>
        </div>

        <TabsContent value="pacotes" className="mt-0">
          <div className="container mx-auto px-4 py-6">
            {loading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : skins.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Nenhum pacote publicado no momento.</p>
              </div>
            ) : (
              <ApeGrid cols={{ default: 2, md: 3, lg: 4 }}>
                {skins.map((skin) => (
                  <SkinCard
                    key={skin.id}
                    skin={skin}
                    owned={ownedSkinIds.has(skin.id)}
                    onPurchase={handlePurchase}
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
