# GLOSSARY

Domain language for OrcBot. This file exists so that seams can be named after the product's
own concepts. The architecture vocabulary (**module**, **interface**, **depth**, **seam**,
**adapter**, **leverage**, **locality**) lives in the `codebase-design` skill; this file holds
only the domain words.

Every entry says what the term means and where it lives. When a deepening needs a name, take
it from here. If the concept is missing, add it here before naming a module after it.

## Work

**action** - one queued unit of work for the agent. Carries an id, a priority, a status
(queued, in-progress, completed, failed, waiting), a retry policy, a TTL, and optional
chaining to a parent action and its children. Source: `src/memory/ActionQueue.ts`.

**action queue** - the durable, priority-sorted store of actions. Source:
`src/memory/ActionQueue.ts`.

**step** - one turn inside an action's execution loop: the decision engine picks tools, the
pipeline guards them, the tools run, and the observation is written to memory. A step is
identified as `{actionId}-step-{n}-{skill}`.

**simulation** - the pre-plan produced before an action's steps run. Source:
`src/core/SimulationEngine.ts`.

**guardrail** - a check applied after a decision is parsed and before tools run:
deduplication, loop detection, skill frequency limits, consecutive-failure limits. Source:
`src/core/DecisionPipeline.ts`. Guardrails are deliberate and are not weakened.

## Capability

**skill** - a callable capability the decision engine can select, defined by a name, a
description, a usage string and a handler. Source: `src/core/SkillsManager.ts`.

**core skill** - a skill registered in code at startup. Today those registrations live
inside `Agent.ts`.

**plugin** - a skill loaded at runtime from `~/.orcbot/plugins/` as a `.ts` or `.js` module
exporting `{ name, description, usage, handler }`.

**Agent Skill** - a declarative `SKILL.md` package following the agentskills.io format
(instructions, scripts, references, assets), loaded progressively on activation. Distinct
from a **skill**: an Agent Skill is instructions, a skill is a handler.

**tool** - the registry-side view of capability that the TUI manages. In practice one tool
maps to one skill.

**channel** - an inbound and outbound messaging surface: Telegram, WhatsApp, Discord, Slack,
Email, or the **gateway**. Source: `src/channels/`.

**gateway** - the web surface: an Express and WebSocket server plus the ops dashboard.
Source: `src/gateway/GatewayServer.ts`, `apps/dashboard/`.

## Memory

**short memory** - transient observations: step results, tool output, inbound messages.
Cleaned up when the owning action ends. Source: `src/memory/MemoryManager.ts`.

**episodic memory** - durable, LLM-written summaries. One is written when an action starts
and one when it concludes.

**long memory** - the markdown-backed long-term store. `DailyMemory` is its concrete form:
a long-term file plus one file per day, under the **data home**.

**consolidation** - the pass that folds accumulated short memory into durable summaries.
Source: `MemoryManager.consolidate()`.

**data home** - the directory holding all runtime state, `~/.orcbot/` by default or whatever
`ORCBOT_DATA_DIR` points at.

**knowledge store** - the retrieval store backing RAG over ingested documents. Source:
`src/memory/KnowledgeStore.ts`.

## Autonomy

**heartbeat** - the periodic proactive wake-up that lets the agent act without being asked.
A heartbeat is either lightweight (a cheap check) or full (a complete decision cycle).

**scheduled task** - a job on the cron-like scheduler, either a heartbeat schedule or an
explicit task. Source: `src/core/Scheduler.ts`.

**worker** - an isolated process running its own agent loop, used for parallel execution.
Source: `src/core/AgentWorker.ts`.

**worker profile** - the declared capabilities and limits a worker runs under. Source:
`src/core/WorkerProfile.ts`.

**orchestrator** - the module that delegates actions to workers and tracks their state.
Source: `src/core/AgentOrchestrator.ts`.

**peer agent** - another agent instance the current one can create or configure.

**TForce** - the tactical self-monitoring subsystem: a conscience engine, an error-fixer
engine, and an incident memory. Source: `src/codes/tforce/`.

## Addresses

**chat id** - the channel-specific identifier for a conversation. Resolving the right one for
the current action and channel is a repeated concern; Telegram chat ids in particular have
their own resolution path.

**session scope** - the identifier grouping a set of related conversations so that context
does not leak between unrelated ones.

## Learning

**trajectory** - a recorded action with its steps and outcome, kept as a candidate training
example. Source: `src/core/TrajectoryStore.ts`.

**self-training** - the offline loop that captures trajectories, prepares datasets,
evaluates candidate models, and promotes a candidate under admin control. Source:
`src/core/SelfTrainingManager.ts`.

**tuner** - the runtime knobs adjusted from observed signals. Source:
`src/core/RuntimeTuner.ts`.
