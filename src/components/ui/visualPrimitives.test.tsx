import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { Badge } from "./badge";
import { Button } from "./button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./card";
import { Surface } from "./surface";
import { Text } from "./text";

describe("semantic visual primitives", () => {
  it("keeps shared buttons safe by default and exposes semantic state", () => {
    const markup = renderToStaticMarkup(<Button>Continuar</Button>);

    expect(markup).toContain('type="button"');
    expect(markup).toContain('data-ape-ui="button"');
    expect(markup).toContain('data-ape-variant="default"');
    expect(markup).toContain("min-h-[44px]");
    expect(markup).toContain("touch-manipulation");
  });

  it("marks interactive card styling without inventing button semantics", () => {
    const interactive = renderToStaticMarkup(
      <Card surface="interactive">
        <CardHeader>
          <CardTitle>Lista</CardTitle>
          <CardDescription>Descrição legível</CardDescription>
        </CardHeader>
        <CardContent>Conteúdo</CardContent>
      </Card>,
    );
    const base = renderToStaticMarkup(<Card>Conteúdo</Card>);

    expect(interactive).toContain('data-ape-surface="interactive"');
    expect(interactive).toContain('data-ape-interactive="true"');
    expect(interactive).not.toContain("tabindex");
    expect(interactive).toContain("ape-card-description");
    expect(base).not.toContain("tabindex");
  });

  it("renders status and product badges with explicit variants", () => {
    expect(renderToStaticMarkup(<Badge variant="success">Concluído</Badge>)).toContain(
      'data-ape-variant="success"',
    );
    expect(renderToStaticMarkup(<Badge variant="pitecoin">25</Badge>)).toContain(
      'data-ape-variant="pitecoin"',
    );
  });

  it("renders semantic text tones and surfaces without container opacity", () => {
    const text = renderToStaticMarkup(
      <Text as="span" tone="supporting" size="sm">
        Ajuda
      </Text>,
    );
    const surface = renderToStaticMarkup(
      <Surface as="section" surface="raised" density="play">
        Conteúdo
      </Surface>,
    );

    expect(text).toContain('data-ape-tone="supporting"');
    expect(text).toContain("text-content-supporting");
    expect(surface).toContain('data-ape-surface="raised"');
    expect(surface).toContain('data-ape-density="play"');
    expect(surface).not.toContain("opacity");
  });
});
