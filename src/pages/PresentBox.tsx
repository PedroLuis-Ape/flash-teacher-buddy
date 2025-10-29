import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Gift, Clock, Check, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { getUserGifts, claimGift, dismissGift, type GiftOffer } from "@/lib/giftEngine";
import { supabase } from "@/integrations/supabase/client";
import { FEATURE_FLAGS } from "@/lib/featureFlags";
import { getRarityColor, getRarityLabel } from "@/lib/storeEngine";

export default function PresentBox() {
  const [gifts, setGifts] = useState<GiftOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [skins, setSkins] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    if (!FEATURE_FLAGS.present_inbox_visible) {
      navigate('/');
      return;
    }

    loadGifts();
    loadSkins();
  }, [navigate]);

  const loadGifts = async () => {
    setLoading(true);
    const data = await getUserGifts();
    setGifts(data);
    setLoading(false);
  };

  const loadSkins = async () => {
    const { data } = await supabase
      .from('skins_catalog')
      .select('*')
      .eq('is_active', true);
    
    setSkins(data || []);
  };

  const handleClaim = async (gift: GiftOffer) => {
    setProcessing(gift.id);
    const result = await claimGift(gift.id);
    setProcessing(null);

    if (result.success) {
      if (result.alreadyOwned) {
        toast({
          title: "Presente convertido!",
          description: `Você já possuía este item. Recebeu ₱${result.pitecoinBonus} PITECOIN como bônus.`,
        });
      } else {
        toast({
          title: "Presente recebido!",
          description: "Item adicionado ao seu inventário.",
        });
      }
      loadGifts();
    } else {
      toast({
        title: "Erro",
        description: result.error || "Não foi possível reivindicar o presente.",
        variant: "destructive",
      });
    }
  };

  const handleDismiss = async (giftId: string) => {
    setProcessing(giftId);
    const result = await dismissGift(giftId);
    setProcessing(null);

    if (result.success) {
      toast({
        title: "Presente dispensado",
        description: "O presente foi removido da sua caixa.",
      });
      loadGifts();
    } else {
      toast({
        title: "Erro",
        description: result.error || "Não foi possível dispensar o presente.",
        variant: "destructive",
      });
    }
  };

  const getSkinDetails = (skinId: string) => {
    return skins.find(s => s.id === skinId);
  };

  const isExpired = (gift: GiftOffer) => {
    return gift.expires_at && new Date(gift.expires_at) < new Date();
  };

  const pendingGifts = gifts.filter(g => g.status === 'pending' && !isExpired(g));
  const claimedGifts = gifts.filter(g => g.status === 'claimed');
  const expiredGifts = gifts.filter(g => isExpired(g) || g.status === 'expired');

  if (loading) {
    return (
      <div className="container max-w-4xl py-8">
        <Card>
          <CardContent className="p-8 text-center">
            <p>Carregando presentes...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">🎁 Caixa de Presentes</h1>
        <p className="text-muted-foreground">
          Presentes enviados pelos administradores
        </p>
      </div>

      {pendingGifts.length === 0 && claimedGifts.length === 0 && expiredGifts.length === 0 && (
        <Alert>
          <Gift className="h-4 w-4" />
          <AlertDescription>
            Você não tem presentes no momento.
          </AlertDescription>
        </Alert>
      )}

      {pendingGifts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Presentes Pendentes</h2>
          <div className="grid gap-4">
            {pendingGifts.map(gift => {
              const skin = getSkinDetails(gift.skin_id);
              if (!skin) return null;

              return (
                <Card key={gift.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <img 
                          src={skin.card_img} 
                          alt={skin.name}
                          className="w-24 h-24 object-cover rounded"
                        />
                        <div>
                          <CardTitle>{skin.name}</CardTitle>
                          <Badge 
                            className="mt-1"
                            style={{ backgroundColor: getRarityColor(skin.rarity) }}
                          >
                            {getRarityLabel(skin.rarity)}
                          </Badge>
                          {gift.message && (
                            <CardDescription className="mt-2">
                              "{gift.message}"
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        Expira em {gift.expires_at ? new Date(gift.expires_at).toLocaleDateString() : 'Nunca'}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDismiss(gift.id)}
                          disabled={processing === gift.id}
                        >
                          <X className="h-4 w-4 mr-1" />
                          Dispensar
                        </Button>
                        <Button
                          onClick={() => handleClaim(gift)}
                          disabled={processing === gift.id}
                        >
                          <Gift className="h-4 w-4 mr-1" />
                          {processing === gift.id ? "Processando..." : "Reivindicar"}
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {claimedGifts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-xl font-semibold mb-4">Presentes Reivindicados</h2>
          <div className="grid gap-4">
            {claimedGifts.map(gift => {
              const skin = getSkinDetails(gift.skin_id);
              if (!skin) return null;

              return (
                <Card key={gift.id} className="opacity-60">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <img 
                        src={skin.card_img} 
                        alt={skin.name}
                        className="w-16 h-16 object-cover rounded"
                      />
                      <div>
                        <CardTitle className="text-base">{skin.name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Check className="h-4 w-4 text-green-500" />
                          Reivindicado em {gift.claimed_at ? new Date(gift.claimed_at).toLocaleDateString() : ''}
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {expiredGifts.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Presentes Expirados</h2>
          <div className="grid gap-4">
            {expiredGifts.map(gift => {
              const skin = getSkinDetails(gift.skin_id);
              if (!skin) return null;

              return (
                <Card key={gift.id} className="opacity-40">
                  <CardHeader>
                    <div className="flex items-center gap-4">
                      <img 
                        src={skin.card_img} 
                        alt={skin.name}
                        className="w-16 h-16 object-cover rounded grayscale"
                      />
                      <div>
                        <CardTitle className="text-base">{skin.name}</CardTitle>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                          <Clock className="h-4 w-4" />
                          Expirado
                        </div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}