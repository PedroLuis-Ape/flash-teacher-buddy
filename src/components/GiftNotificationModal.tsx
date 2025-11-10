import { useEffect, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { getUserGifts, claimGift, dismissGift, GiftOffer } from "@/lib/giftEngine";
import { supabase } from "@/integrations/supabase/client";
import { Gift, Sparkles } from "lucide-react";
import { toast } from "sonner";
import pitecoinImg from "@/assets/pitecoin.png";

interface SkinData {
  id: string;
  name: string;
  avatar_src: string | null;
  card_src: string | null;
  avatar_img: string | null;
  card_img: string | null;
  price_pitecoin: number;
}

export function GiftNotificationModal() {
  const [gift, setGift] = useState<GiftOffer | null>(null);
  const [skinData, setSkinData] = useState<SkinData | null>(null);
  const [loading, setLoading] = useState(false);
  const [claiming, setClaiming] = useState(false);

  useEffect(() => {
    loadPendingGifts();
  }, []);

  const loadPendingGifts = async () => {
    setLoading(true);
    try {
      const gifts = await getUserGifts();
      const pendingGift = gifts.find(g => g.status === 'pending');
      
      if (pendingGift) {
        setGift(pendingGift);
        
        // Fetch skin data
        const { data } = await supabase
          .from('skins_catalog')
          .select('id, name, avatar_src, card_src, avatar_img, card_img, price_pitecoin')
          .eq('id', pendingGift.skin_id)
          .single();
        
        if (data) {
          setSkinData(data);
        }
      }
    } catch (error) {
      console.error('Error loading gifts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (!gift) return;
    
    setClaiming(true);
    try {
      const result = await claimGift(gift.id);
      
      if (result.success) {
        if (result.alreadyOwned && result.pitecoinBonus) {
          toast.success(`Você já tinha essa skin! Recebeu ${result.pitecoinBonus} PiteCoins de bônus.`);
        } else {
          toast.success("Presente recebido com sucesso!");
        }
        setGift(null);
        setSkinData(null);
      } else {
        toast.error(result.error || "Erro ao aceitar presente");
      }
    } catch (error) {
      console.error('Error claiming gift:', error);
      toast.error("Erro ao aceitar presente");
    } finally {
      setClaiming(false);
    }
  };

  const handleDismiss = async () => {
    if (!gift) return;
    
    setClaiming(true);
    try {
      const result = await dismissGift(gift.id);
      
      if (result.success) {
        toast.info("Presente dispensado");
        setGift(null);
        setSkinData(null);
      } else {
        toast.error(result.error || "Erro ao dispensar presente");
      }
    } catch (error) {
      console.error('Error dismissing gift:', error);
      toast.error("Erro ao dispensar presente");
    } finally {
      setClaiming(false);
    }
  };

  if (loading || !gift || !skinData) return null;

  return (
    <Dialog open={!!gift} onOpenChange={(open) => !open && handleDismiss()}>
      <DialogContent className="max-w-md p-0 overflow-hidden border-2 border-primary/20">
        <div className="relative bg-gradient-to-b from-primary/20 to-background p-8 text-center">
          {/* Sparkles decoration */}
          <div className="absolute top-4 left-4 text-primary/40">
            <Sparkles className="w-8 h-8" />
          </div>
          <div className="absolute top-4 right-4 text-primary/40">
            <Sparkles className="w-8 h-8" />
          </div>
          
          {/* Gift icon */}
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mb-4">
            <Gift className="w-8 h-8 text-primary" />
          </div>
          
          {/* Title */}
          <h2 className="text-2xl font-bold mb-2">
            Parabéns! 🎉
          </h2>
          <p className="text-muted-foreground mb-6">
            Você ganhou um presente da DM
          </p>
          
          {/* Gift content */}
          <div className="bg-background/80 backdrop-blur-sm rounded-lg p-6 mb-6">
            <h3 className="font-semibold text-lg mb-4">{skinData.name}</h3>
            
            <div className="flex justify-center gap-4">
              {/* Avatar */}
              {(skinData.avatar_src || skinData.avatar_img) && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/20 mb-2">
                    <img 
                      src={skinData.avatar_src || skinData.avatar_img || ''} 
                      alt={`${skinData.name} avatar`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Avatar</span>
                </div>
              )}
              
              {/* Card */}
              {(skinData.card_src || skinData.card_img) && (
                <div className="flex flex-col items-center">
                  <div className="w-24 h-32 rounded-lg overflow-hidden border-2 border-primary/20 mb-2">
                    <img 
                      src={skinData.card_src || skinData.card_img || ''} 
                      alt={`${skinData.name} card`}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">Card</span>
                </div>
              )}
            </div>
            
            {/* PiteCoin value info */}
            <div className="mt-4 flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <img src={pitecoinImg} alt="PiteCoin" className="w-5 h-5" />
              <span>Valor: {skinData.price_pitecoin} PiteCoins</span>
            </div>
          </div>
          
          {/* Message from DM */}
          {gift.message && (
            <div className="bg-muted/50 rounded-lg p-3 mb-6 text-sm italic">
              "{gift.message}"
            </div>
          )}
          
          {/* Actions */}
          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={handleDismiss}
              disabled={claiming}
            >
              Dispensar
            </Button>
            <Button
              className="flex-1"
              onClick={handleClaim}
              disabled={claiming}
            >
              {claiming ? "Aceitando..." : "Aceitar"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
