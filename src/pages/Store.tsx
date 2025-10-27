import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PitecoLogo } from "@/components/PitecoLogo";
import { ArrowLeft, Package } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";

const Store = () => {
  const navigate = useNavigate();

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
                Colecione cartas e avatares do Piteco. (Em breve)
              </p>
            </div>
          </div>
          <ThemeToggle />
        </div>

        <div className="max-w-2xl mx-auto">
          <Card className="text-center p-12">
            <CardHeader className="space-y-4">
              <div className="flex justify-center">
                <div className="relative">
                  <PitecoLogo className="w-32 h-32 opacity-80" />
                  <Package className="absolute bottom-0 right-0 h-12 w-12 text-primary/60" />
                </div>
              </div>
              <CardTitle className="text-2xl">A vitrine ainda está sendo montada.</CardTitle>
              <CardDescription className="text-base">
                Volte em breve para ver os pacotes de cartas e avatares exclusivos do Piteco!
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="bg-muted/50 rounded-lg p-4 text-sm text-muted-foreground">
                Em breve você poderá usar seus <span className="font-semibold text-primary">PITECOINS</span> para
                adquirir itens especiais e personalizar sua experiência de estudo.
              </div>
              <Button onClick={() => navigate("/folders")} variant="outline" className="mt-4">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para Pastas
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Store;
