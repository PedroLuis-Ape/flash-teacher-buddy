import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const paletteCss = readFileSync(resolve(root, "src/styles/space-ui-v1.css"), "utf8");
const baseCss = readFileSync(resolve(root, "src/index.css"), "utf8");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\./.test(entry.name) ? [full] : [];
  });
}

/** Extrai os tokens de `html[data-palette="<id>"]{...}`. */
function tokensOf(id: string): Record<string, string> {
  const match = paletteCss.match(new RegExp(`html\\[data-palette="${id}"\\]\\{([^}]*)\\}`));
  if (!match) throw new Error(`paleta ${id} nao encontrada em space-ui-v1.css`);
  return parseTokens(match[1]);
}

function parseTokens(block: string): Record<string, string> {
  const tokens: Record<string, string> = {};
  for (const entry of block.split(";")) {
    const [rawName, rawValue] = entry.split(":");
    if (!rawName || !rawValue) continue;
    tokens[rawName.trim().replace(/^--/, "")] = rawValue.trim();
  }
  return tokens;
}

function hslToRgb(hsl: string): [number, number, number] {
  const [h, s, l] = hsl.split(/\s+/).map((part) => Number.parseFloat(part));
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hp = h / 60;
  const x = chroma * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1 ? [chroma, x, 0] :
    hp < 2 ? [x, chroma, 0] :
    hp < 3 ? [0, chroma, x] :
    hp < 4 ? [0, x, chroma] :
    hp < 5 ? [x, 0, chroma] : [chroma, 0, x];
  const m = lightness - chroma / 2;
  return [r1 + m, g1 + m, b1 + m];
}

function luminance(hsl: string): number {
  const channel = (value: number) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4);
  const [r, g, b] = hslToRgb(hsl).map(channel);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

// `black` e uma paleta escura: herda os semanticos (destructive/success/warning)
// do bloco `.dark`, que segue sendo a fonte desses tokens.
function darkBaseTokens(): Record<string, string> {
  const match = baseCss.match(/\n\s*\.dark \{([^}]*)\}/);
  if (!match) throw new Error("bloco .dark nao encontrado em index.css");
  return parseTokens(match[1]);
}

const black = { ...darkBaseTokens(), ...tokensOf("black") };

describe("paleta padrao (APE Preto) — identidade e contraste", () => {
  const pairs: Array<[string, string, number]> = [
    ["foreground", "background", 4.5],
    ["card-foreground", "card", 4.5],
    ["popover-foreground", "popover", 4.5],
    ["muted-foreground", "muted", 4.5],
    ["primary-foreground", "primary", 4.5],
    ["secondary-foreground", "secondary", 4.5],
    ["accent-foreground", "accent", 4.5],
    ["destructive-foreground", "destructive", 4.5],
  ];

  it.each(pairs)("%s sobre %s atinge AA (>= %s)", (fg, bg, min) => {
    expect(black[fg]).toBeDefined();
    expect(black[bg]).toBeDefined();
    expect(contrast(black[fg], black[bg])).toBeGreaterThanOrEqual(min);
  });

  it.each(["primary", "destructive", "secondary"])("%s e legivel como cor sobre o fundo", (token) => {
    expect(contrast(black[token], black.background)).toBeGreaterThanOrEqual(3);
  });

  it("abandonou a dependencia de roxo na identidade principal", () => {
    const primaryHue = Number.parseFloat(black.primary.split(/\s+/)[0]);
    const accentHue = Number.parseFloat(black.accent.split(/\s+/)[0]);
    // Roxo/violeta fica entre 250 e 300; a nova identidade usa teal + ambar.
    expect(primaryHue >= 150 && primaryHue <= 200).toBe(true);
    expect(accentHue >= 20 && accentHue <= 60).toBe(true);
  });

  it("mantem os neutros dessaturados (sem cast roxo)", () => {
    const background = black.background.split(/\s+/).map(Number.parseFloat);
    expect(background[1]).toBeLessThanOrEqual(25);
    expect(background[0] >= 200 && background[0] <= 250).toBe(true);
  });

  it("nao deixa classes roxas hardcoded na interface do produto", () => {
    const roxo = /(?:violet|purple|fuchsia)-[0-9]{3}/g;
    const ofensores = sourceFiles(resolve(root, "src")).flatMap((file) => {
      const found = readFileSync(file, "utf8").match(roxo);
      return found ? [`${file.replace(root, "")}: ${found.join(", ")}`] : [];
    });
    expect(ofensores).toEqual([]);
  });

  it("tem uma unica fonte de tokens por paleta", () => {
    // Duplicar os blocos de paleta em outro arquivo faz a copia vencer por
    // especificidade e congela a identidade antiga.
    const duplicados = sourceFiles(resolve(root, "src"))
      .filter((file) => !file.endsWith("space-ui-v1.css"))
      .filter((file) => /html\[data-palette="[a-z]+"\][^{]*\{[^}]*--background:/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(root, ""));
    expect(duplicados).toEqual([]);
  });
});
