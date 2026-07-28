import { useState } from "react";
import { createRoot } from "react-dom/client";
import {
  AlertTriangle,
  Check,
  Coins,
  Info,
  Sparkles,
  Trophy,
} from "lucide-react";

import "@/index.css";
import "@/styles/piteco-play.css";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Surface } from "@/components/ui/surface";
import { Text } from "@/components/ui/text";
import {
  applyVisualPreferences,
  type ResolvedAppearance,
  type VisualStyle,
} from "@/lib/visualPreferences";

export function PrimitiveLab() {
  const [appearance, setAppearance] = useState<ResolvedAppearance>("dark");
  const [visualStyle, setVisualStyle] = useState<VisualStyle>("playful");

  const applyPreview = (
    nextAppearance: ResolvedAppearance,
    nextVisualStyle: VisualStyle,
  ) => {
    setAppearance(nextAppearance);
    setVisualStyle(nextVisualStyle);
    applyVisualPreferences({
      version: 1,
      appearance: nextAppearance,
      visualStyle: nextVisualStyle,
      palette: "black",
    });
  };

  return (
    <main className="mx-auto min-h-dvh max-w-5xl space-y-6 px-4 py-6 sm:px-6 sm:py-10">
      <header className="space-y-4">
        <div>
          <Text as="span" tone="supporting" size="sm" weight="strong">
            QA local · não publicado
          </Text>
          <Text as="div" size="display" weight="expressive">
            Laboratório Piteco Play
          </Text>
          <Text tone="secondary" size="sm">
            Tokens e primitivos isolados para regressão visual, contraste,
            teclado e mobile.
          </Text>
        </div>

        <Surface
          as="section"
          surface="sunken"
          density="compact"
          aria-label="Controles da prévia"
          className="flex flex-wrap gap-2"
        >
          {(["light", "dark"] as const).map((option) => (
            <Button
              key={option}
              variant={appearance === option ? "default" : "outline"}
              size="sm"
              aria-pressed={appearance === option}
              onClick={() => applyPreview(option, visualStyle)}
            >
              {option === "light" ? "Claro" : "Escuro"}
            </Button>
          ))}
          {(["classic", "playful"] as const).map((option) => (
            <Button
              key={option}
              variant={visualStyle === option ? "secondary" : "outline"}
              size="sm"
              aria-pressed={visualStyle === option}
              onClick={() => applyPreview(appearance, option)}
            >
              {option === "playful" ? "Piteco Play" : "Clássico"}
            </Button>
          ))}
        </Surface>
      </header>

      <section className="grid gap-4 lg:grid-cols-2">
        <Card surface="raised" density="play">
          <CardHeader>
            <CardTitle>Ações táteis</CardTitle>
            <CardDescription>
              O estado pressionado move o controle sem atrasar a ação.
            </CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2">
            <Button>
              <Sparkles aria-hidden="true" />
              Continuar
            </Button>
            <Button variant="secondary">
              <Trophy aria-hidden="true" />
              Ver progresso
            </Button>
            <Button variant="outline">Agora não</Button>
            <Button variant="destructive">
              <AlertTriangle aria-hidden="true" />
              Remover
            </Button>
            <Button disabled>Indisponível</Button>
            <Button variant="ghost">Ação discreta</Button>
          </CardContent>
        </Card>

        <Card surface="interactive" density="play" aria-label="Card interativo">
          <CardHeader>
            <div className="flex flex-wrap gap-2">
              <Badge variant="success">
                <Check aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                Concluído
              </Badge>
              <Badge variant="warning">
                <AlertTriangle aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                Atenção
              </Badge>
              <Badge variant="info">
                <Info aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
                Informação
              </Badge>
            </div>
            <CardTitle>Card com silhueta firme</CardTitle>
            <CardDescription>
              Cor, ícone e texto trabalham juntos para comunicar o estado.
            </CardDescription>
          </CardHeader>
          <CardFooter className="flex-wrap gap-2">
            <Badge variant="xp">
              <Trophy aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              120 XP
            </Badge>
            <Badge variant="pitecoin">
              <Coins aria-hidden="true" className="mr-1 h-3.5 w-3.5" />
              25 PiteCOIN
            </Badge>
          </CardFooter>
        </Card>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        <Surface surface="base" density="work">
          <Text weight="strong">Superfície base</Text>
          <Text tone="secondary" size="sm">
            Conteúdo cotidiano e estável.
          </Text>
        </Surface>
        <Surface surface="raised" density="work">
          <Text weight="strong">Superfície elevada</Text>
          <Text tone="supporting" size="sm">
            Ações e conteúdo em destaque.
          </Text>
        </Surface>
        <Surface surface="sunken" density="work">
          <Text weight="strong">Superfície rebaixada</Text>
          <Text tone="supporting" size="sm">
            Agrupamento e informação auxiliar.
          </Text>
        </Surface>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Visual QA root not found");

createRoot(root).render(<PrimitiveLab />);
