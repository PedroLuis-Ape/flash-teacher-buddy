import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./piteco-play.css", import.meta.url), "utf8");

type Hsl = [number, number, number];

function selectorBlock(selector: string): string {
  const start = css.indexOf(`${selector} {`);
  if (start < 0) throw new Error(`Missing selector: ${selector}`);
  const end = css.indexOf("\n}", start);
  if (end < 0) throw new Error(`Unclosed selector: ${selector}`);
  return css.slice(start, end);
}

function token(block: string, name: string): Hsl {
  const match = block.match(
    new RegExp(`--${name}:\\s*([\\d.]+)\\s+([\\d.]+)%\\s+([\\d.]+)%`),
  );
  if (!match) throw new Error(`Missing HSL token: --${name}`);
  return [Number(match[1]), Number(match[2]), Number(match[3])];
}

function hslToRgb([h, saturation, lightness]: Hsl): [number, number, number] {
  const s = saturation / 100;
  const l = lightness / 100;
  const chroma = (1 - Math.abs(2 * l - 1)) * s;
  const segment = ((h % 360) + 360) % 360 / 60;
  const intermediate = chroma * (1 - Math.abs((segment % 2) - 1));
  const offset = l - chroma / 2;
  const base: [number, number, number] =
    segment < 1
      ? [chroma, intermediate, 0]
      : segment < 2
        ? [intermediate, chroma, 0]
        : segment < 3
          ? [0, chroma, intermediate]
          : segment < 4
            ? [0, intermediate, chroma]
            : segment < 5
              ? [intermediate, 0, chroma]
              : [chroma, 0, intermediate];
  return base.map((value) => value + offset) as [number, number, number];
}

function luminance(hsl: Hsl): number {
  const channels = hslToRgb(hsl).map((channel) =>
    channel <= 0.03928
      ? channel / 12.92
      : ((channel + 0.055) / 1.055) ** 2.4,
  );
  return (
    channels[0] * 0.2126 +
    channels[1] * 0.7152 +
    channels[2] * 0.0722
  );
}

function contrast(foreground: Hsl, background: Hsl): number {
  const foregroundLuminance = luminance(foreground);
  const backgroundLuminance = luminance(background);
  return (
    (Math.max(foregroundLuminance, backgroundLuminance) + 0.05) /
    (Math.min(foregroundLuminance, backgroundLuminance) + 0.05)
  );
}

const modes = [
  'html[data-visual-style="playful"][data-resolved-appearance="light"]',
  'html[data-visual-style="playful"][data-resolved-appearance="dark"]',
] as const;

describe("Piteco Play token contract", () => {
  it.each(modes)(
    "%s keeps primary, secondary and supporting text at the 7:1 target",
    (selector) => {
      const block = selectorBlock(selector);
      const textTokens = [
        "ape-text-primary",
        "ape-text-secondary",
        "ape-text-supporting",
      ];
      const surfaceTokens = [
        "ape-surface-canvas",
        "ape-surface-base",
        "ape-surface-raised",
        "ape-surface-sunken",
      ];

      for (const textToken of textTokens) {
        for (const surfaceToken of surfaceTokens) {
          expect(
            contrast(token(block, textToken), token(block, surfaceToken)),
            `${textToken} on ${surfaceToken}`,
          ).toBeGreaterThanOrEqual(7);
        }
      }
    },
  );

  it.each(modes)(
    "%s keeps every semantic action and status label at the 7:1 target",
    (selector) => {
      const block = selectorBlock(selector);
      const pairs = [
        ["ape-action-primary-foreground", "ape-action-primary"],
        ["ape-action-secondary-foreground", "ape-action-secondary"],
        ["ape-action-danger-foreground", "ape-action-danger"],
        ["ape-feedback-success-foreground", "ape-feedback-success"],
        ["ape-feedback-error-foreground", "ape-feedback-error"],
        ["ape-feedback-warning-foreground", "ape-feedback-warning"],
        ["ape-feedback-info-foreground", "ape-feedback-info"],
      ] as const;

      for (const [foreground, background] of pairs) {
        expect(
          contrast(token(block, foreground), token(block, background)),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(7);
      }
    },
  );

  it.each(modes)(
    "%s keeps disabled controls at least AA without fading their container",
    (selector) => {
      const block = selectorBlock(selector);
      expect(
        contrast(
          token(block, "ape-action-disabled-foreground"),
          token(block, "ape-action-disabled"),
        ),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it("scopes expressive overrides and keeps reduced motion effective", () => {
    expect(css).toContain(
      'html[data-visual-style="playful"] .ape-button-primitive',
    );
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain("--ape-motion-standard: 1ms");
    expect(css).toContain("min-height: 44px");
    expect(css).toContain("outline: 3px solid");
    expect(css).toContain("opacity: 1");
    expect(css).not.toContain("!important");
  });
});
