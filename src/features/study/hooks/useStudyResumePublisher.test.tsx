import React from "react";
import { act, create, type ReactTestRenderer } from "react-test-renderer";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { useStudyResumePublisher, type StudyResumePublisherInput } from "./useStudyResumePublisher";
import { readStudyResumePointer, studyResumePointerKey } from "@/features/study/lib/studyResumePointer";
import { DEFAULT_STUDY_SETTINGS_SNAPSHOT } from "@/features/study/lib/studySettingsSnapshotV2";

function createStorage() {
  const map = new Map<string, string>();
  return {
    map,
    get length() { return map.size; },
    key: (index: number) => [...map.keys()][index] ?? null,
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

const baseInput: StudyResumePublisherInput = {
  userId: "u1",
  sessionId: "11111111-2222-3333-4444-555555555555",
  resourceKind: "list",
  resourceId: "lista-a",
  gameMode: "flip",
  institutionId: null,
  path: "/list/lista-a/study?mode=flip&dir=any&order=random",
  settingsSummary: DEFAULT_STUDY_SETTINGS_SNAPSHOT,
  currentIndex: 4,
  currentCardId: "card-4",
  layerIndex: null,
  deckReady: true,
};

let storage = createStorage();
let renderer: ReactTestRenderer | undefined;
let publish: () => void = () => undefined;

function Harness(input: StudyResumePublisherInput) {
  const result = useStudyResumePublisher(input, storage);
  publish = result.publish;
  return null;
}

async function mount(input: StudyResumePublisherInput) {
  await act(async () => { renderer = create(<Harness {...input} />); });
}

describe("publicação do ponteiro de retomada (camada comum de todas as superfícies de estudo)", () => {
  beforeEach(() => {
    storage = createStorage();
  });

  afterEach(async () => {
    await act(async () => renderer?.unmount());
    renderer = undefined;
  });

  it("publica a sessão da superfície de estudo simples", async () => {
    await mount(baseInput);
    expect(readStudyResumePointer("u1", storage)?.resourceId).toBe("lista-a");
  });

  it("publica também a Prática Mista, que antes nunca atualizava o card da Home", async () => {
    await mount({
      ...baseInput,
      sessionId: "22222222-3333-4444-5555-666666666666",
      resourceId: "lista-mixed",
      gameMode: "mixed-adaptive",
      path: "/list/lista-mixed/mixed-study?mode=mixed&dir=any&order=random",
    });

    const pointer = readStudyResumePointer("u1", storage);
    expect(pointer?.resourceId).toBe("lista-mixed");
    expect(pointer?.gameMode).toBe("mixed-adaptive");
    expect(pointer?.path).toContain("/list/lista-mixed/mixed-study");
  });

  it("troca o ponteiro quando o usuário passa a estudar outra lista", async () => {
    await mount(baseInput);
    await act(async () => {
      renderer?.update(<Harness {...baseInput} resourceId="lista-b" sessionId="33333333-4444-5555-6666-777777777777" path="/list/lista-b/study?mode=flip" />);
    });
    expect(readStudyResumePointer("u1", storage)?.resourceId).toBe("lista-b");
  });

  it("visitante (sem usuário) não escreve no escopo do usuário nem no escopo anon", async () => {
    await mount({ ...baseInput, userId: null });
    expect(storage.map.size).toBe(0);
    expect(storage.getItem(studyResumePointerKey("anon"))).toBeNull();
  });

  it("nunca publica sessão concluída nem sessão sem identidade", async () => {
    await mount({ ...baseInput, finished: true });
    expect(storage.map.size).toBe(0);

    await act(async () => { renderer?.unmount(); renderer = undefined; });
    await mount({ ...baseInput, sessionId: null });
    expect(storage.map.size).toBe(0);

    await act(async () => { renderer?.unmount(); renderer = undefined; });
    await mount({ ...baseInput, resourceId: null });
    expect(storage.map.size).toBe(0);
  });

  it("não publica com deck vazio (currentIndex 0 antes de o deck carregar)", async () => {
    await mount({ ...baseInput, deckReady: false, currentIndex: 0, currentCardId: null });
    expect(storage.map.size).toBe(0);

    // Deck carregado: o ponteiro passa a apontar para a posição real.
    await act(async () => {
      renderer?.update(
        <Harness {...baseInput} deckReady currentIndex={3} currentCardId="card-3" />,
      );
    });

    const pointer = readStudyResumePointer("u1", storage);
    expect(pointer?.currentIndex).toBe(3);
    expect(pointer?.currentCardId).toBe("card-3");
  });

  it("publish() manual também respeita o deck vazio (contrato de 'Salvar e sair')", async () => {
    await mount({ ...baseInput, deckReady: false, currentIndex: 0, currentCardId: null });
    await act(async () => {
      publish();
    });
    expect(storage.map.size).toBe(0);
  });

  it("recusa rota pública/portal como destino de retomada", async () => {
    await mount({ ...baseInput, path: "/portal/list/lista-a/study?mode=flip" });
    expect(storage.map.size).toBe(0);
  });

  it("publish() manual republica a posição atual (contrato de 'Salvar e sair')", async () => {
    await mount(baseInput);
    await act(async () => {
      renderer?.update(<Harness {...baseInput} currentIndex={9} currentCardId="card-9" />);
    });
    await act(async () => { publish(); });
    expect(readStudyResumePointer("u1", storage)?.currentIndex).toBe(9);
  });
});
