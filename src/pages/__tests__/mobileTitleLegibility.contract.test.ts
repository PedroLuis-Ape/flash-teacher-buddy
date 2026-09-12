import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const folder = readFileSync(new URL("../Folder.tsx", import.meta.url), "utf8");
const turma = readFileSync(new URL("../../components/TurmaShortcut.tsx", import.meta.url), "utf8");

describe("nomes de lista e turma legiveis no mobile", () => {
  it("permite a quebra da linha da lista para o titulo nao ser espremido", () => {
    // O Button compartilhado impoe min-w-[44px]; quatro acoes somam ~188px e
    // deixavam apenas 76px para o titulo em viewport de 393px.
    expect(folder).toContain('className="p-3 flex flex-wrap items-center gap-3"');
    expect(folder).toContain('className="flex-1 min-w-[9rem]"');
  });

  it("usa duas linhas no nome da turma em vez de cortar com reticencias", () => {
    expect(turma).toContain(
      'className="block line-clamp-2 break-words text-xs font-semibold leading-tight sm:text-sm"',
    );
  });
});

