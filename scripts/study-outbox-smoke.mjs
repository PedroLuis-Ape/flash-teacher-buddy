import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import ts from "typescript";
import { chromium } from "playwright";

// Exercise the real IndexedDB implementation, without any production backend.
const source = await readFile("src/features/study/lib/studyPersistenceOutbox.ts", "utf8");
const js = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
}).outputText;
const server = createServer((req, res) => {
  res.setHeader("Content-Type", req.url === "/outbox.js" ? "text/javascript" : "text/html");
  res.end(req.url === "/outbox.js" ? js : "<!doctype html><title>Isolated outbox test</title>");
});
await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
const url = `http://127.0.0.1:${server.address().port}`;
let browser;
try {
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  await context.route("**/*", route => route.request().url().startsWith(url)
    ? route.continue() : route.abort());
  const first = await context.newPage();
  const second = await context.newPage();
  await Promise.all([first.goto(url), second.goto(url)]);
  await first.evaluate(async () => {
    const q = await import("/outbox.js");
    await q.enqueueStudySessionSnapshot({
      key: "user:session", userId: "user", sessionId: "session", listId: "list",
      mode: "flip", sessionScopeKey: "scope", revision: 1, payload: { current_index: 0 }, updatedAt: 1,
    });
    await q.markStudySessionSnapshotFailed("user:session", 1, new Error("offline"));
    await q.enqueueStudyProgress({ operationId: "answer-1", userId: "user", listId: "list", flashcardId: "a", correct: true });
  });
  await second.evaluate(async () => {
    const q = await import("/outbox.js");
    await q.enqueueStudySessionSnapshot({
      key: "user:session", userId: "user", sessionId: "session", listId: "list",
      mode: "flip", sessionScopeKey: "scope", revision: 2, payload: { current_index: 1 }, updatedAt: 2,
    });
  });
  await first.reload();
  const restored = await first.evaluate(async () => {
    const q = await import("/outbox.js");
    await q.requeueStudyOutbox("user");
    await q.markStudySessionSnapshotSuccess("user:session", 1);
    return {
      sessions: await q.listPendingStudySessionSnapshots("user"),
      progress: await q.listPendingStudyProgress("user"),
      other: await q.listPendingStudyProgress("another-user"),
    };
  });
  assert.equal(restored.sessions.length, 1);
  assert.equal(restored.sessions[0].revision, 2);
  assert.equal(restored.progress.length, 1);
  assert.equal(restored.other.length, 0);
  const remaining = await second.evaluate(async () => {
    const q = await import("/outbox.js");
    await q.markStudySessionSnapshotSuccess("user:session", 2);
    await q.markStudyProgressSuccess("answer-1");
    await q.requeueStudyOutbox("user");
    return [await q.listPendingStudySessionSnapshots("user"), await q.listPendingStudyProgress("user")];
  });
  assert.deepEqual(remaining, [[], []]);
  console.log("PASS IndexedDB: reload, two tabs, stale acknowledgement, account isolation, no resurrection");
} finally {
  await browser?.close();
  await new Promise(resolve => server.close(resolve));
}
