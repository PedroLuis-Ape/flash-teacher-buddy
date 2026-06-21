import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";

const command = process.platform === "win32" ? "npx.cmd" : "npx";
const result = spawnSync(command, ["vitest", "run", "--passWithNoTests"], {
  encoding: "utf8",
  env: process.env,
});

const stdout = result.stdout || "";
const stderr = result.stderr || "";
const exitCode = typeof result.status === "number" ? result.status : 1;

writeFileSync(
  "lint-report.json",
  JSON.stringify({ exitCode, stdout, stderr }, null, 2),
  "utf8",
);

process.stdout.write(stdout);
process.stderr.write(stderr);
process.exit(exitCode);
