import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const backendDir = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(backendDir, "..");
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

/** Prefer repo-root `.venv` when present so `pip install -r backend/requirements.txt` in the venv is used. */
function resolvePythonFromVenv() {
  const winPython = path.join(".venv", "Scripts", "python.exe");
  const unixCandidates = [path.join(".venv", "bin", "python3"), path.join(".venv", "bin", "python")];
  const candidates =
    process.platform === "win32" ? [winPython] : unixCandidates;
  for (const rel of candidates) {
    const abs = path.join(repoRoot, rel);
    if (!fs.existsSync(abs)) {
      continue;
    }
    const probe = spawnSync(abs, ["-c", "import sys"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) {
      return { command: abs, prefixArgs: [] };
    }
  }
  return null;
}

function resolvePython() {
  const fromEnv = process.env.SPECFLOW_PYTHON?.trim();
  if (fromEnv) {
    const probe = spawnSync(fromEnv, ["-c", "import sys"], { stdio: "ignore" });
    if (!probe.error && probe.status === 0) {
      return { command: fromEnv, prefixArgs: [] };
    }
    console.warn(
      `SPECFLOW_PYTHON is set but not executable; falling back to venv / PATH.`
    );
  }

  const venv = resolvePythonFromVenv();
  if (venv) {
    return venv;
  }

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
