import { existsSync, readFileSync } from "node:fs";
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
const catalog = JSON.parse(readFileSync(path.join(root, "store-packages", "catalog.json"), "utf8")) as Catalog;
const official = [
  ["piteco_prime", "Piteco Prime", "legendary", 750],
  ["piteco_vampiro", "Piteco Vampiro", "epic", 500],
  ["piteco_zombie", "Piteco Zombie", "rare", 300],
  ["piteco_ninja", "Piteco Ninja", "epic", 500],
  ["piteco_astronauta", "Piteco Astronauta", "epic", 500],
  ["piteco_explorador", "Piteco Explorador", "rare", 300],
] as const;

function isPng(filename: string): boolean {
  const bytes = readFileSync(filename);
  return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
}

function isAvif(filename: string): boolean {
  const bytes = readFileSync(filename);
  if (bytes.length < 12) return false;
  const box = bytes.subarray(4, 12).toString("ascii");
  return box === "ftypavif" || box === "ftypavis";
}

function findAsset(id: string, basename: string): string {
  for (const extension of ["avif", "png"]) {
    const filename = path.join(root, "store-packages", id, `${basename}.${extension}`);
    if (existsSync(filename)) return filename;
  }
  return "";
}

describe("canonical App Piteco store catalog", () => {
  it("contains only the six official active bundles", () => {
    expect(catalog.schema).toBe("app-piteco-store-catalog");
    expect(catalog.version).toBe(1);
    expect(catalog.packages).toHaveLength(official.length);
    expect(catalog.packages.map(({ id, name, rarity, price_pitecoin, active }) => [id, name, rarity, price_pitecoin, active]))
      .toEqual(official.map((item) => [...item, true]));
  });

  it("keeps card and avatar together as valid image assets", () => {
    for (const [id] of official) {
      const card = findAsset(id, "card");
      const avatar = findAsset(id, "avatar");
      expect(card, `${id} card`).not.toBe("");
      expect(avatar, `${id} avatar`).not.toBe("");
      expect(card.endsWith(".png") ? isPng(card) : isAvif(card), `${id} card válido`).toBe(true);
      expect(avatar.endsWith(".png") ? isPng(avatar) : isAvif(avatar), `${id} avatar válido`).toBe(true);
    }
  });
});
