import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { PitecoLogo } from "@/components/PitecoLogo";
import { ArrowLeft, Loader2 } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { EconomyBadge } from "@/components/EconomyBadge";
import { SkinCard } from "@/components/SkinCard";
import { getSkinsCaltalog, getUserInventory, purchaseSkin, type SkinItem } from "@/lib/storeEngine";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FEATURE_FLAGS } from "@/lib/featureFlags";

const Store = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [skins, setSkins] = useState<SkinItem[]>([]);
  const [ownedSkinIds, setOwnedSkinIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [purchasing, setPurchasing] = useState(false);
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
    if (!userId) return;

    setPurchasing(true);
    try {
      const result = await purchaseSkin(userId, skinId, price);
      
      if (result.success) {
        toast({
          title: "Compra realizada!",
          description: result.message,
        });
        // Reload inventory
        const inventoryData = await getUserInventory(userId);
        setOwnedSkinIds(new Set(inventoryData.map(item => item.skin_id)));
      } else {
        toast({
          title: "Erro na compra",
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
      setPurchasing(false);
    }
  };

  if (!FEATURE_FLAGS.store_visible) {
    navigate('/folders');
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 via-background to-secondary/5">
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/folders")}
              aria-label="Voltar para pastas"
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <PitecoLogo className="w-12 h-12" />
            <div>
              <h1 className="text-3xl font-bold">Loja do Piteco</h1>
              <p className="text-sm text-muted-foreground">
                Colecione cartas e avatares exclusivos do Piteco
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {FEATURE_FLAGS.economy_enabled && <EconomyBadge />}
            <ThemeToggle />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : skins.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhum pacote publicado no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {skins.map((skin) => (
              <SkinCard
                key={skin.id}
                skin={skin}
                owned={ownedSkinIds.has(skin.id)}
                onPurchase={handlePurchase}
                loading={purchasing}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Store;
