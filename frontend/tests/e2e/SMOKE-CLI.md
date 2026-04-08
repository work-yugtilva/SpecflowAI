# SpecFlow smoke — Playwright CLI (interactive)

Use this for **manual** debugging when you want element refs from snapshots. Automated PASS/FAIL is in `specflow-full-smoke.spec.ts` (`npm run e2e -- tests/e2e/specflow-full-smoke.spec.ts`).

## Prerequisite

```bash
command -v npx >/dev/null 2>&1 && echo "npx ok" || echo "Install Node.js/npm"
```

## Skill wrapper

```bash
export CODEX_HOME="${CODEX_HOME:-$HOME/.codex}"
export PWCLI="$CODEX_HOME/skills/playwright/scripts/playwright_cli.sh"
"$PWCLI" --help
```

## Services

- Next.js: `http://localhost:3000` (`npm run dev` in `frontend/`)
- Pipeline API: default `http://localhost:8001` (see `NEXT_PUBLIC_PIPELINE_URL`)

## Ordered flow (re-snapshot after every navigation)

Refs (`e12`, …) change each run — always `**snapshot**` before `**click**`.

1. **Open app**
  ```bash
   "$PWCLI" open http://localhost:3000 --headed
   "$PWCLI" snapshot
  ```
2. **Auth** — if not logged in, use refs from snapshot for email/password fields and submit (or sign in via `/login`).
3. **Sessions**
  ```bash
   "$PWCLI" open http://localhost:3000/sessions
   "$PWCLI" snapshot
  ```
   Open **New Session**, submit name, choose **Start Fresh Context** in the modal.
4. **Context gate** — `/context`: fill Company Name, Product Name, Description, Target Users, Goals → **Save Context**.
5. **Research** — `/research`: **Add Research**, paste `tests/e2e/fixtures/sample-transcript.txt`, **Add Entry**.
6. **Pipeline** — `/sessions`: select session → **Run full pipeline** → wait until “Session completed”.
7. **Query** — QueryPanel is not mounted in the app today; skip or use **Ask SpecFlow** float on `/features` (different from `QueryPanel`).
8. **Evidence** — `/features`: select a feature → **View source evidence →**.
9. **PRD** — `/prd`: **Generate PRD** / **Regenerate**, Full view.
10. **Handoff** — `/tasks`: **Generate Handoff** → **Export for Agent ↓** if needed.

## Artifacts

Screenshots from the CLI: prefer repo `output/playwright/` if your harness writes there. Playwright **Test** writes failures under `frontend/test-results/playwright-artifacts/` (see `playwright.config.ts`).