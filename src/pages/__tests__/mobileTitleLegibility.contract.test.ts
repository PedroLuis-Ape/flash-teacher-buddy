import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const folder = readFileSync(new URL("../Folder.tsx", import.meta.url), "utf8");
const turma = readFileSync(new URL("../../components/TurmaShortcut.tsx", import.meta.url), "utf8");

describe("nomes de lista e turma legiveis no mobile", () => {
  it("preserva largura do titulo da lista e move as acoes para um menu compacto", () => {
    // No mobile, o conteúdo textual pode encolher corretamente e as ações deixam
    // de competir horizontalmente com o título. O grupo inline permanece só em sm+.
    expect(folder).toContain('className="flex min-w-0 items-start gap-3 p-3 sm:items-center"');
    expect(folder).toContain('className="min-w-0 flex-1"');
    expect(folder).toContain('className="shrink-0 sm:hidden"');
    expect(folder).toContain('className="hidden shrink-0 gap-1 sm:flex"');
  });

  it("usa duas linhas no nome da turma em vez de cortar com reticencias", () => {
    expect(turma).toContain(
      'className="block line-clamp-2 break-words text-xs font-semibold leading-tight sm:text-sm"',
    );
  });
});
