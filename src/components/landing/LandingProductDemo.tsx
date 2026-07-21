import { useId, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { LandingHomeContent } from "@/content/public/landingContent";

interface LandingProductDemoProps {
  demo: LandingHomeContent["demo"];
}

export function LandingProductDemo({ demo }: LandingProductDemoProps) {
  const [activeId, setActiveId] = useState(demo.items[0]?.id ?? "");
  const groupId = useId();
  const activeItem = demo.items.find((item) => item.id === activeId) ?? demo.items[0];

  if (!activeItem) return null;

  return (
    <section aria-labelledby={`${groupId}-heading`} className="border-y border-border/40 bg-muted/15">
      <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[.82fr_1.18fr] lg:items-center">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-primary">Demonstração editorial</p>
          <h2 id={`${groupId}-heading`} className="mt-2 text-2xl font-bold sm:text-4xl">{demo.heading}</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">{demo.intro}</p>
          <div role="tablist" aria-label="Tipos de card" className="mt-5 flex flex-wrap gap-2">
            {demo.items.map((item) => (
              <Button
                key={item.id}
                id={`${groupId}-tab-${item.id}`}
                type="button"
                role="tab"
                size="sm"
                variant={item.id === activeItem.id ? "default" : "outline"}
                aria-selected={item.id === activeItem.id}
                aria-controls={`${groupId}-panel-${item.id}`}
                onClick={() => setActiveId(item.id)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>

        <Card
          id={`${groupId}-panel-${activeItem.id}`}
          role="tabpanel"
          aria-labelledby={`${groupId}-tab-${activeItem.id}`}
          tabIndex={0}
          className="overflow-hidden border-primary/25 shadow-lg"
        >
          <CardContent className="p-5 sm:p-7">
            <p className="text-xs uppercase tracking-wider text-muted-foreground">{activeItem.subtitle}</p>
            <p className="mt-2 text-3xl font-bold sm:text-4xl">{activeItem.title}</p>
            <div className="mt-5 space-y-2">
              {activeItem.lines.map((line) => (
                <p key={line} className="rounded-lg border bg-background/70 px-3 py-2.5 text-sm sm:text-base">{line}</p>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="sr-only" aria-label="Conteúdo de todos os exemplos">
          {demo.items.map((item) => (
            <article key={item.id}>
              <h3>{item.label}: {item.title}</h3>
              <p>{item.subtitle}</p>
              {item.lines.map((line) => <p key={line}>{line}</p>)}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
