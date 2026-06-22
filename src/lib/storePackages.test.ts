import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

interface CatalogPackage {
  id: string;
  name: string;
  rarity: "normal" | "rare" | "epic" | "legendary";
  price_pitecoin: number;
  active: boolean;
}

interface Catalog {
  schema: string;
  version: number;
  packages: CatalogPackage[];
}

const root = process.cwd();
const catalog = JSON.parse(
  readFileSync(path.join(root, "store-packages", "catalog.json"), "utf8"),
) as Catalog;

const official = [
  ["piteco_prime", "Piteco Prime", "legendary", 750],
  ["piteco_vampiro", "Piteco Vampiro", "epic", 500],
  ["piteco_zombie", "Piteco Zombie", "rare", 300],
  ["piteco_ninja", "Piteco Ninja", "epic", 500],
  ["piteco_astronauta", "Piteco Astronauta", "epic", 500],
  ["piteco_explorador", "Piteco Explorador", "rare", 300],
] as const;

function isAvif(filename: string): boolean {
  const bytes = readFileSync(filename);
  if (bytes.length < 12) return false;
  const box = bytes.subarray(4, 12).toString("ascii");
  return box === "ftypavif" || box === "ftypavis";
}

describe("canonical App Piteco store catalog", () => {
  it("contains only the six official active bundles", () => {
    expect(catalog.schema).toBe("app-piteco-store-catalog");
    expect(catalog.version).toBe(1);
    expect(catalog.packages).toHaveLength(official.length);

    expect(
      catalog.packages.map(({ id, name, rarity, price_pitecoin, active }) => [
        id,
        name,
        rarity,
        price_pitecoin,
        active,
      ]),
    ).toEqual(official.map((item) => [...item, true]));
  });

  it("keeps card and avatar together as real AVIF assets", () => {
    for (const [id] of official) {
      const card = path.join(root, "store-packages", id, "card.avif");
      const avatar = path.join(root, "store-packages", id, "avatar.avif");
      expect(existsSync(card), `${id} card`).toBe(true);
      expect(existsSync(avatar), `${id} avatar`).toBe(true);
      expect(isAvif(card), `${id} card AVIF`).toBe(true);
      expect(isAvif(avatar), `${id} avatar AVIF`).toBe(true);
    }
  });
});
