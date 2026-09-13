import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";
import {
  HOME_DATA_QUERY_KEY,
  STUDY_RESUME_QUERY_KEY,
  invalidateStudyResumeCaches,
} from "./studyResumeCache";

describe("invalidação de cache da retomada", () => {
  it("marca retomada e Home como obsoletas em qualquer escopo", async () => {
    const client = new QueryClient();
    const resumeKey = [STUDY_RESUME_QUERY_KEY, "u1", "general"];
    const homeKey = [HOME_DATA_QUERY_KEY, "u1", "general"];
    client.setQueryData(resumeKey, { sessionId: "s-a" });
    client.setQueryData(homeKey, { recents: [] });

    await invalidateStudyResumeCaches(client);

    expect(client.getQueryState(resumeKey)?.isInvalidated).toBe(true);
    expect(client.getQueryState(homeKey)?.isInvalidated).toBe(true);
  });

  it("invalida também escopos de outros usuários/institutions já carregados", async () => {
    const client = new QueryClient();
    const otherScope = [STUDY_RESUME_QUERY_KEY, "u2", "inst-1"];
    client.setQueryData(otherScope, { sessionId: "s-b" });

    await invalidateStudyResumeCaches(client);

    expect(client.getQueryState(otherScope)?.isInvalidated).toBe(true);
  });
});
