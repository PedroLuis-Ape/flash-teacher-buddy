import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ApeAppBar } from "@/components/ape/ApeAppBar";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Lock, Crown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Realm } from "@/lib/realmTypes";

const Reinos = () => {
  const navigate = useNavigate();
  const [realms, setRealms] = useState<Realm[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadRealms();
  }, []);

  const loadRealms = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("realms-list");
      
      if (error) throw error;
      
      if (data?.success && data?.realms) {
        setRealms(data.realms);
      } else {
        throw new Error(data?.message || "Erro ao carregar reinos");
      }
    } catch (error: any) {
      console.error("Erro ao carregar reinos:", error);
      toast.error("Não foi possível carregar os reinos");
    } finally {
      setLoading(false);
    }
  };

  const handleRealmClick = (realm: Realm) => {
    toast.info("Em breve.");
  };

  return (
    <div className="min-h-screen bg-background">
      <ApeAppBar title="Reinos (Em breve)" showBack backPath="/" />

      <div className="container mx-auto px-4 py-6">
        <div className="max-w-md mx-auto space-y-6">
          {loading ? (
            <>
              {[...Array(3)].map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="h-24 w-full rounded-xl" />
                  {i < 2 && (
                    <div className="flex justify-center">
                      <ChevronUp className="h-8 w-8 text-muted-foreground/30" />
                    </div>
                  )}
                </div>
              ))}
            </>
          ) : (
            <div className="flex flex-col-reverse space-y-reverse space-y-3">
              {realms.map((realm, index) => (
                <div key={realm.id} className="space-y-3">
                  <Card
                    className={`${
                      realm.locked
                        ? "bg-muted/50 cursor-not-allowed"
                        : "cursor-pointer hover:shadow-lg transition-shadow"
                    }`}
                    onClick={() => !realm.locked && handleRealmClick(realm)}
                    role="button"
                    tabIndex={realm.locked ? -1 : 0}
                    aria-disabled={realm.locked}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center gap-4">
                        <div
                          className={`h-16 w-16 rounded-full flex items-center justify-center shrink-0 ${
                            realm.locked
                              ? "bg-muted"
                              : "bg-gradient-to-br from-primary/20 to-secondary/20"
                          }`}
                        >
                          {realm.locked ? (
                            <Lock className="h-8 w-8 text-muted-foreground" />
                          ) : (
                            <Crown className="h-8 w-8 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3
                            className={`font-semibold text-lg ${
                              realm.locked ? "text-muted-foreground" : ""
                            }`}
                          >
                            {realm.title}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {realm.locked ? "Bloqueado" : "Disponível"}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {index < realms.length - 1 && (
                    <div className="flex justify-center py-2">
                      <ChevronUp
                        className={`h-8 w-8 ${
                          realm.locked
                            ? "text-muted-foreground/30"
                            : "text-primary/50"
                        }`}
                      />
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reinos;
