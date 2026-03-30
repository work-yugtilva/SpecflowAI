import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, "..");
const pipelineDir = path.resolve(backendDir, "src");
const port = process.env.PIPELINE_PORT ?? "8001";

const candidates =
  process.platform === "win32"
    ? [
        { command: "py", prefixArgs: ["-3"] },
        { command: "python", prefixArgs: [] },
      ]
    : [
        { command: "python3", prefixArgs: [] },
        { command: "python", prefixArgs: [] },
      ];

function resolvePython() {
  for (const candidate of candidates) {
    const probe = spawnSync(
      candidate.command,
      [...candidate.prefixArgs, "-c", "import sys"],
      { stdio: "ignore" }
    );
    if (!probe.error && probe.status === 0) {
      return candidate;
    }
  }
  return null;
}

const python = resolvePython();

if (!python) {
  console.error(
    "Unable to find a Python interpreter for the SpecFlow pipeline. Install Python and backend/requirements.txt dependencies first."
  );
  process.exit(1);
}

const child = spawn(
  python.command,
  [
    ...python.prefixArgs,
    "-m",
    "uvicorn",
    "main:app",
    "--reload",
    "--host",
    "0.0.0.0",
    "--port",
    port,
  ],
  {
    cwd: pipelineDir,
    stdio: "inherit",
    env: process.env,
  }
);

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exit(code ?? 0);
});
