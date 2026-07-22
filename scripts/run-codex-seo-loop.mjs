import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";

const root = process.cwd();
const execute = process.argv.includes("--execute");
const allowDirty = process.argv.includes("--allow-dirty");
const promptPath = resolve(root, "prompts/codex-seo-visibility-loop.md");
const reportDir = resolve(root, "reports/seo-visibility");
const lastMessagePath = resolve(reportDir, "codex-last-message.md");

function run(command, args, options = {}) {
  return spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    ...options,
  });
}

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (!existsSync(promptPath)) {
  fail(`Prompt não encontrado: ${promptPath}`);
}

const gitBranch = run("git", ["branch", "--show-current"]);
if (gitBranch.status !== 0) {
  fail("Não foi possível identificar a branch Git atual.");
}

const branch = gitBranch.stdout.trim();
if (!branch) {
  fail("O repositório está em detached HEAD. Crie uma branch antes de executar o loop.");
}
if (["main", "master"].includes(branch)) {
  fail("O loop não pode executar em main/master. Crie uma branch isolada primeiro.");
}

const gitStatus = run("git", ["status", "--porcelain"]);
if (gitStatus.status !== 0) {
  fail("Não foi possível verificar o estado da árvore de trabalho.");
}
if (!allowDirty && gitStatus.stdout.trim()) {
  fail("A árvore de trabalho não está limpa. Faça commit/stash ou use --allow-dirty conscientemente.");
}

const prompt = readFileSync(promptPath, "utf8");
const codexCommand = process.platform === "win32" ? "codex.cmd" : "codex";
const codexVersion = run(codexCommand, ["--version"]);

console.log("APE Search Visibility Experiment Loop");
console.log(`Branch: ${branch}`);
console.log(`Prompt: ${promptPath}`);
console.log("Sandbox: workspace-write");
console.log("Merge/deploy/produção: proibidos pelo prompt e pelo AGENTS.md");

if (codexVersion.status !== 0) {
  console.log("\nCodex CLI não foi encontrado no PATH.");
  console.log("Abra o Codex no repositório e cole o conteúdo de prompts/codex-seo-visibility-loop.md,");
  console.log("ou instale/configure a CLI antes de usar --execute.");
  if (execute) process.exit(1);
} else {
  console.log(`Codex: ${codexVersion.stdout.trim() || codexVersion.stderr.trim()}`);
}

if (!execute) {
  console.log("\nModo de preparação concluído. Nenhum agente foi iniciado.");
  console.log("Para executar em modo não interativo:");
  console.log("  npm run seo:codex-loop -- --execute");
  console.log("\nHabilite acesso controlado à internet no ambiente do Codex somente quando o benchmark externo for necessário.");
  process.exit(0);
}

mkdirSync(reportDir, { recursive: true });

const args = [
  "exec",
  "--sandbox",
  "workspace-write",
  "--json",
  "--output-last-message",
  lastMessagePath,
  "Execute o APE Search Visibility Experiment Loop seguindo integralmente o contexto recebido por stdin.",
];

const result = spawnSync(codexCommand, args, {
  cwd: root,
  input: prompt,
  stdio: ["pipe", "inherit", "inherit"],
});

if (result.error) {
  fail(`Falha ao iniciar Codex: ${result.error.message}`);
}
if (result.status !== 0) {
  fail(`Codex terminou com status ${result.status}. Consulte os logs e ${lastMessagePath}.`);
}

console.log(`Loop concluído. Mensagem final: ${lastMessagePath}`);
