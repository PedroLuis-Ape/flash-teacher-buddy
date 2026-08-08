import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const studyPage = readFileSync(new URL("../../pages/Study.tsx", import.meta.url), "utf8");
const mixedPage = readFileSync(new URL("../../pages/MixedStudy.tsx", import.meta.url), "utf8");
const settingsModal = readFileSync(new URL("./components/GameSettingsModal.impl.tsx", import.meta.url), "utf8");
const studyEditor = readFileSync(new URL("../../pages/Study.tsx", import.meta.url), "utf8");
const listEditor = readFileSync(new URL("../../pages/ListDetail.tsx", import.meta.url), "utf8");
const collectionPage = readFileSync(new URL("../../pages/PublicCollection.tsx", import.meta.url), "utf8");
const classHub = readFileSync(new URL("../../pages/PublicClassGamesHub.tsx", import.meta.url), "utf8");
const learningList = readFileSync(new URL("../../pages/PublicLearningListPage.tsx", import.meta.url), "utf8");

describe("harmonia dos modos de estudo", () => {
  it("mostra as configurações de escrita também no modo misto", () => {
    expect(settingsModal).toContain("const supportsWriteCorrection = isWriteMode || isMixedMode;");
    expect(settingsModal).toContain("{supportsWriteCorrection && (");
  });

  it("mantém ações de fim e retomada na sessão tradicional", () => {
    expect(studyPage).toContain("const showNextRound = hasMoreRounds && !isGameComplete;");
    expect(studyPage).toContain("onClick={startNextRound}");
    expect(studyPage).toContain("Jogar Novamente");
    expect(studyPage).toContain("CONCLUIR SESSÃO");
  });

  it("mantém ações explícitas de rodada e percurso no modo misto", () => {
    expect(mixedPage).toContain('state.status === "round-complete"');
    expect(mixedPage).toContain('state.status === "journey-complete"');
    expect(mixedPage).toContain("Começar próxima rodada");
    expect(mixedPage).toContain("Jogar novamente");
    expect(mixedPage).toContain("Sair e continuar depois");
  });

  it("não trata falha de restauração remota como uma sessão nova silenciosa", () => {
    expect(mixedPage).toContain("remoteRestoreFailure");
    expect(mixedPage).toContain("setRemoteRestoreFailure(true)");
    expect(mixedPage).toContain("restoreResult[0].error");
  });

  it("confirma a persistência do editor no banco antes de atualizar a UI", () => {
    expect(studyEditor).toContain('.select("id")');
    expect(listEditor).toContain('.select("id")');
    expect(studyEditor).toContain("O banco não confirmou a atualização deste card.");
    expect(listEditor).toContain("O banco não confirmou a atualização deste card.");
  });

  it("envia os lançamentos públicos para o runtime misto com contexto completo", () => {
    expect(collectionPage).toContain("/mixed-study?mode=mixed&dir=any&order=random");
    expect(classHub).toContain("mode: 'mixed'");
    expect(classHub).toContain("order,");
    expect(learningList).toContain("mixed-study?mode=mixed&dir=any&order=random");
  });
});
