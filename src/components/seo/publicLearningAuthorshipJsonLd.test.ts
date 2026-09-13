import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPublicLearningResourceStructuredData } from "./publicLearningResourceStructuredData";
import { buildPublicLearningListStructuredData } from "./publicLearningListStructuredData";

type JsonLdNode = Record<string, unknown>;

const RESOURCE_LISTS = [
  {
    id: "22222222-2222-4222-8222-222222222222",
    title: "Verbos básicos",
    description: "Prática de verbos.",
    card_count: 30,
  },
];

const LIST_CARDS = [
  {
    id: "43434343-4343-4343-8343-434343434343",
    term: "wake up",
    translation: "acordar",
    created_at: "2026-07-01T12:00:00.000Z",
  },
];

const AUTHORED_RESOURCE = {
  id: "11111111-1111-4111-8111-111111111111",
  title: "Inglês A1",
  description: "Vocabulário essencial.",
  study_type: "language",
  lang_a: "en",
  lang_b: "pt",
  created_at: "2026-06-01T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
  author_display_name: "Professora Ana",
  author_slug: "ana",
  author_avatar_url: "https://example.com/ana.jpg",
};

const AUTHORED_LIST = {
  id: "41414141-4141-4141-8141-414141414141",
  folder_id: "42424242-4242-4242-8242-424242424242",
  title: "Verbos & rotina",
  description: "Prática de verbos para iniciantes.",
  study_type: "language",
  lang_a: "en",
  lang_b: "pt",
  created_at: "2026-07-01T12:00:00.000Z",
  updated_at: "2026-07-13T12:00:00.000Z",
  folder_title: "Inglês A1",
  author_display_name: "Professor Pedro",
  author_slug: "professor-pedro",
  author_avatar_url: null,
  card_count: 30,
};

const ANONYMOUS_RESOURCE = {
  ...AUTHORED_RESOURCE,
  author_display_name: null,
  author_slug: null,
  author_avatar_url: null,
};

const ANONYMOUS_LIST = {
  ...AUTHORED_LIST,
  author_display_name: null,
  author_slug: null,
  author_avatar_url: null,
};

function graphOf(value: Record<string, unknown>) {
  return value["@graph"] as JsonLdNode[];
}

function nodeOf(graph: JsonLdNode[], type: string) {
  return graph.find((node) => node["@type"] === type);
}

/** Regra do programa: JSON-LD só descreve o que existe no payload. */
function expectAuthorshipGate(
  authored: Record<string, unknown>,
  anonymous: Record<string, unknown>,
  label: string,
) {
  const authoredGraph = graphOf(authored);
  const authoredResource = nodeOf(authoredGraph, "LearningResource");
  const authoredPerson = nodeOf(authoredGraph, "Person");
  expect(authoredPerson, `${label}: com autor o nó Person precisa existir`).toBeDefined();
  expect(authoredResource?.author, `${label}: com autor a referência author precisa existir`).toEqual({
    "@id": authoredPerson?.["@id"],
  });

  const anonymousGraph = graphOf(anonymous);
  expect(
    anonymousGraph.some((node) => node["@type"] === "Person"),
    `${label}: sem autor não pode existir Person`,
  ).toBe(false);
  const anonymousResource = nodeOf(anonymousGraph, "LearningResource");
  expect(anonymousResource, `${label}: LearningResource precisa continuar existindo`).toBeDefined();
  expect(anonymousResource, `${label}: sem autor não pode existir referência author`).not.toHaveProperty("author");

  for (const [variant, value] of [["com autor", authored], ["sem autor", anonymous]] as const) {
    const serialized = JSON.stringify(value);
    expect(serialized, `${label} (${variant}): JSON não pode conter null`).not.toContain(":null");
    expect(serialized, `${label} (${variant}): JSON não pode conter undefined`).not.toContain("undefined");
  }
}

describe("autoria no JSON-LD público de pastas e listas", () => {
  it("material público: Person e author só existem com autor no payload", () => {
    expectAuthorshipGate(
      buildPublicLearningResourceStructuredData(AUTHORED_RESOURCE, RESOURCE_LISTS),
      buildPublicLearningResourceStructuredData(ANONYMOUS_RESOURCE, RESOURCE_LISTS),
      "material público",
    );
  });

  it("lista pública: Person e author só existem com autor no payload", () => {
    expectAuthorshipGate(
      buildPublicLearningListStructuredData(AUTHORED_LIST, LIST_CARDS),
      buildPublicLearningListStructuredData(ANONYMOUS_LIST, LIST_CARDS),
      "lista pública",
    );
  });

  it("mantém o mesmo contrato nos builders de pré-render (.mjs)", { timeout: 30000 }, () => {
    const validators = [
      "scripts/validate-public-learning-resource-prerender.mjs",
      "scripts/validate-public-learning-list-prerender.mjs",
    ];

    for (const validator of validators) {
      const result = spawnSync(process.execPath, [resolve(process.cwd(), validator)], {
        cwd: process.cwd(),
        encoding: "utf8",
      });
      expect(result.status, `${validator} falhou:\n${result.stderr}`).toBe(0);
      expect(result.stdout, `${validator}: gate com autor`).toContain("AUTORIA-GATE com-autor OK");
      expect(result.stdout, `${validator}: gate sem autor`).toContain("AUTORIA-GATE sem-autor OK");
    }
  });
});

