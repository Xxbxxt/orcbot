# AGENTS.md

This file provides guidance to WARP (warp.dev) when working with code in this repository.

## Common commands
- Install deps: `npm install`
- Build (tsc): `npm run build`
- Fast build: `npm run build:fast`
- Dev CLI (ts-node): `npm run dev`
- Run built CLI: `npm run start` (runs `dist/cli/index.js`)
- Tests (Vitest): `npm test`
- Watch tests: `npm run test:watch`
- Run a single test file: `npx vitest run tests/<file>.test.ts`
- Run a single test by name: `npx vitest run -t "test name"`
- Browser tooling smoke test: `npm run browser:test`
- Lint: no lint script is defined in `package.json`

## High-level architecture (big picture)
- **CLI entrypoint**: `src/cli/index.ts` wires the TUI, CLI commands, and bootstraps subsystems.
- **Agent core loop**: `src/core/Agent.ts` orchestrates the action loop (simulate → decide → execute tools → memory → termination review).
- **Decision stack**:
  - `src/core/DecisionEngine.ts` builds prompts and calls the LLM.
  - `src/core/ParserLayer.ts` normalizes LLM output to structured JSON with fallbacks.
  - `src/core/DecisionPipeline.ts` applies guardrails on tool calls (dedup, loop detection, safety checks). Guardrails are intentional—avoid weakening them.
  - `src/core/SimulationEngine.ts` creates a pre-plan before execution starts.
  - `src/core/prompts/` contains modular helpers activated by `PromptRouter`.
- **Memory system (critical)**:
  - `src/memory/MemoryManager.ts` handles short/episodic/long memory and consolidation.
  - `src/memory/ActionQueue.ts` is the durable priority queue for tasks (retry, TTL, chaining).
  - Storage is file-backed via `src/storage/JSONAdapter.ts` (atomic writes + backups).
  - Vector memory (`src/memory/VectorMemory.ts`) is optional and file-backed.
  - Important constraints from existing instructions: keep `saveMemory` content short (<500 chars), include metadata (`actionId`, `step`, `skill`) for step memories, and avoid storing secrets in memory.
- **Skills system**:
  - Core skills registered in `src/core/Agent.ts`.
  - Dynamic plugins loaded by `src/core/SkillsManager.ts` from `~/.orcbot/plugins/` (or `./plugins`).
- **Channels**: `src/channels/` implements Telegram (Telegraf), WhatsApp (Baileys), Discord (discord.js), and Gateway (Express+WS). Inbound messages write short memory and push tasks to the queue.
- **Web/browser tooling**: `src/tools/WebBrowser.ts` wraps Playwright and provides search fallbacks (Serper → Google → Bing → DuckDuckGo).
- **Config + runtime tuning**:
  - `src/config/ConfigManager.ts` loads `orcbot.config.yaml` with hot-reload and feature toggles.
  - `src/core/RuntimeTuner.ts` adjusts runtime limits based on signals.
  - `src/core/MultiLLM.ts` routes providers by model prefix and falls back on errors.
- **Data paths**: runtime state lives under `~/.orcbot/` (or `ORCBOT_DATA_DIR`) including config, memory, queue, logs, profiles, and plugins.

## Notes pulled from existing project instructions
- The memory subsystem is the most complex and common source of behavior bugs; read the memory section in `.github/copilot-instructions.md` before changing it.
- The action loop guardrails in the decision pipeline are intentional; avoid weakening or removing them without a strong reason.

<!-- antislop:start -->
## antislop
For UI, copy, people, mobile layout, or code comments work, read `.agents/antislop.md` (core) and then the skill for the task:
- UI / visual: `.agents/skills/antislop-ui/SKILL.md`
For UI work, read `DESIGN.md` first for OrcBot's direction (identity, palette, typography, dials), then `.agents/antislop.md` as the filter.
Before starting, follow the core's "Two Usage Modes" section in strict order: explicit session instruction first, then global preference, then ask. A session instruction always wins. For a resolved mode, say `antislop active: <mode> (session override).` or `antislop active: <mode> (global preference).` once before presenting findings or making edits, using the actual mode and source. Acknowledging the user's request without naming the source does not replace this notice.
Only an explicit choice of antislop during or after selects a session mode. A request to review, audit, or avoid file edits does not select a mode; read the global preference in that case. Another skill's mode does not select antislop's mode.
If the mode is unresolved, ask during/after and end the response; wait for the answer before any UI review, planning, or concept. For read-only tasks, put the active-mode notice only at the start of the final answer, never in progress messages. For editing tasks, announce before the first edit and omit it from the final answer.
To update antislop later: download `antislop.md` again, or run `npx antislop-ai --update` if it was installed as skill folders.
<!-- antislop:end -->
