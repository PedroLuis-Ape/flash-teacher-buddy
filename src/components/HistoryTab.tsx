import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { formatPitecoin } from "@/lib/rewardEngine";
import { TrendingUp, ShoppingBag, Gift } from "lucide-react";

interface Transaction {
  id: string;
  amount: number;
  balance_after: number;
  type: 'earn' | 'spend' | 'bonus';
  source: string;
  created_at: string;
}

export function HistoryTab() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTransactions();
  }, []);

  const loadTransactions = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const { data, error } = await supabase
        .from('pitecoin_transactions')
        .select('*')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setTransactions((data || []) as Transaction[]);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'earn': return <TrendingUp className="h-4 w-4 text-green-500" />;
      case 'spend': return <ShoppingBag className="h-4 w-4 text-red-500" />;
      case 'bonus': return <Gift className="h-4 w-4 text-primary" />;
      default: return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'earn': return 'text-green-600 dark:text-green-400';
      case 'spend': return 'text-red-600 dark:text-red-400';
      case 'bonus': return 'text-primary';
      default: return 'text-foreground';
    }
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <p className="text-center text-muted-foreground">Carregando histórico...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Histórico de PITECOIN</CardTitle>
        <CardDescription>
          Todas as suas transações
        </CardDescription>
      </CardHeader>
      <CardContent>
        {transactions.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Nenhuma transação ainda</p>
            <p className="text-sm text-muted-foreground mt-2">
              Continue estudando para ganhar recompensas!
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px] pr-4">
            <div className="space-y-3">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="flex items-start justify-between p-3 border rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className="flex items-start gap-3 flex-1">
                    <div className="mt-1">{getTypeIcon(tx.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{tx.source}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </p>
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 ml-4">
                    <Badge
                      variant="outline"
                      className={getTypeColor(tx.type)}
                    >
                      {tx.type === 'spend' ? '-' : '+'}{formatPitecoin(tx.amount)}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      Saldo: {formatPitecoin(tx.balance_after)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
