import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRightLeft, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useEconomy } from "@/contexts/EconomyContext";
import { 
  getExchangeConfig, 
  getExchangeQuote, 
  processExchange,
  type ExchangeConfig,
  type ExchangeQuote
} from "@/lib/exchangeEngine";
import pitecoinIcon from "@/assets/pitecoin.png";

export function ExchangeTab() {
  const { toast } = useToast();
  const { pts_weekly, balance_pitecoin, refreshBalance } = useEconomy();
  const [config, setConfig] = useState<ExchangeConfig | null>(null);
  const [pts, setPts] = useState<string>("");
  const [quote, setQuote] = useState<ExchangeQuote | null>(null);
  const [loading, setLoading] = useState(false);
  const [quoting, setQuoting] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    loadConfig();
    loadUserId();
  }, []);

  useEffect(() => {
    // Get quote when user types a valid amount
    const ptsNum = parseInt(pts);
    if (userId && config && !isNaN(ptsNum) && ptsNum >= config.min_pts_per_tx) {
      const timeoutId = setTimeout(() => {
        handleGetQuote(ptsNum);
      }, 500);
      return () => clearTimeout(timeoutId);
    } else {
      setQuote(null);
    }
  }, [pts, userId, config]);

  const loadUserId = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      setUserId(session.user.id);
    }
  };

  const loadConfig = async () => {
    const result = await getExchangeConfig();
    if (result.success && result.config) {
      setConfig(result.config);
    } else {
      toast({
        title: "Erro",
        description: result.message || "Erro ao carregar configuração.",
        variant: "destructive"
      });
    }
  };

  const handleGetQuote = async (ptsAmount: number) => {
    if (!userId) return;

    setQuoting(true);
    try {
      const result = await getExchangeQuote(userId, ptsAmount);
      
      if (result.success && result.quote) {
        setQuote(result.quote);
      } else {
        setQuote(null);
        if (result.error !== 'MIN_AMOUNT') {
          toast({
            title: "Aviso",
            description: result.message,
            variant: "destructive"
          });
        }
      }
    } catch (error) {
      console.error("Quote error:", error);
      setQuote(null);
    } finally {
      setQuoting(false);
    }
  };

  const handleQuickSelect = (amount: number) => {
    setPts(amount.toString());
  };

  const handleConvert = async () => {
    if (!userId) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado.",
        variant: "destructive"
      });
      return;
    }

    const ptsNum = parseInt(pts);
    if (isNaN(ptsNum) || ptsNum <= 0) {
      toast({
        title: "Erro",
        description: "Valor inválido. Tente outro número.",
        variant: "destructive"
      });
      return;
    }

    setLoading(true);
    try {
      const operationId = crypto.randomUUID();
      const result = await processExchange(userId, ptsNum, operationId);

      if (result.success) {
        toast({
          title: "Sucesso!",
          description: result.message || "Conversão concluída!",
        });

        // Update economy context immediately
        if (result.newPtc !== undefined) {
          await refreshBalance();
        }

        // Clear form
        setPts("");
        setQuote(null);
      } else {
        const errorMessages: Record<string, string> = {
          'MIN_AMOUNT': 'Quantidade mínima não atingida.',
          'DAILY_CAP_REACHED': 'Limite diário de conversão atingido.',
          'INVALID_INPUT': 'Valor inválido. Tente outro número.',
          'INSUFFICIENT_FUNDS': result.message || 'Saldo insuficiente.',
          'INTERNAL_ERROR': 'Não foi possível converter agora. Tente novamente.'
        };

        const errorMessage = result.error
          ? errorMessages[result.error] || result.message
          : result.message;

        toast({
          title: "Erro",
          description: errorMessage,
          variant: "destructive"
        });
      }
    } catch (error) {
      console.error("Conversion error:", error);
      toast({
        title: "Erro",
        description: "Não foi possível converter agora. Tente novamente.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  if (!config) {
    return (
      <div className="p-4">
        <Card>
          <CardContent className="py-12 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </CardContent>
        </Card>
      </div>
    );
  }

  const ptsNum = parseInt(pts);
  const isValidAmount = !isNaN(ptsNum) && ptsNum >= config.min_pts_per_tx;

  return (
    <div className="p-4 space-y-4">
      {/* Balances Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Seus Saldos</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">PTS Semanal</p>
              <p className="text-2xl font-bold">{pts_weekly}</p>
            </div>
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">PITECOIN</p>
              <p className="text-2xl font-bold flex items-center gap-1">
                <img src={pitecoinIcon} alt="₱" className="h-5 w-5" />
                {balance_pitecoin}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Exchange Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowRightLeft className="h-5 w-5" />
            Câmbio
          </CardTitle>
          <CardDescription>
            Converta seus pontos semanais em PITECOIN
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Input */}
          <div className="space-y-2">
            <label className="text-sm font-medium">PTS a converter</label>
            <Input
              type="number"
              placeholder={`Mínimo ${config.min_pts_per_tx} PTS`}
              value={pts}
              onChange={(e) => setPts(e.target.value)}
              min={config.min_pts_per_tx}
              max={pts_weekly}
              className="text-lg h-12"
            />
          </div>

          {/* Quick Select Buttons */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(100)}
              disabled={pts_weekly < 100}
            >
              100
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(500)}
              disabled={pts_weekly < 500}
            >
              500
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickSelect(1000)}
              disabled={pts_weekly < 1000}
            >
              1000
            </Button>
          </div>

          {/* Quote Display */}
          {quoting && (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            </div>
          )}

          {!quoting && quote && (
            <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Você receberá:</span>
                <Badge variant="secondary" className="text-base gap-1">
                  <img src={pitecoinIcon} alt="₱" className="h-4 w-4" />
                  {quote.ppc_out}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Taxa:</span>
                <span>1 ₱ = {Math.round(1 / quote.rate)} PTS</span>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Limite diário restante:</span>
                <span className="font-medium">{quote.daily_remaining_pts} PTS</span>
              </div>
            </div>
          )}

          {/* Convert Button */}
          <Button
            onClick={handleConvert}
            disabled={!isValidAmount || loading || quoting || !quote}
            className="w-full min-h-[44px]"
            size="lg"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Convertendo...
              </>
            ) : (
              "Confirmar conversão"
            )}
          </Button>

          {/* Help Text */}
          <p className="text-xs text-muted-foreground text-center">
            Mínimo: {config.min_pts_per_tx} PTS • Limite diário: {config.daily_pts_cap} PTS
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
