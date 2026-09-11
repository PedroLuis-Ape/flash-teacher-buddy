# Piteco Memory Skills Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Install and operationalize the supplied `piteco-second-brain-protocol` and `piteco-adaptive-learning-loop` Skills for App Piteco engineering, reuse the existing Second Brain as the single operational memory, and make the repository enforce and validate the workflow.

**Architecture:** The two stable Skills live in the user Codex Skills directory. The repository copy at `docs/brain/` becomes the canonical Obsidian-compatible operational memory, migrated from the existing external vault without deleting or rewriting its history. `AGENTS.md` requires both Skills for meaningful Piteco work. Mutable learning artifacts live under the existing brain's `learning/` structure; the core Skills are changed only through an explicit promotion proposal. Git remains the implementation source of truth.

**Tech Stack:** Markdown with YAML Properties and Obsidian wikilinks, PowerShell for safe bulk migration, Node.js ESM for a dependency-free `brain:check`, Vitest for focused checker tests, Git worktree for isolated repository changes.

**Spec:** Preserve the supplied Skill contents and resources; do not simplify the protocols. Keep red-note Obsidian styling and existing links/Properties. Add mandatory preflight, prediction/evidence/diagnosis/retest/lesson flow, canonical-vault provenance, and a future-ready `npm run brain:check` command.

## Global Constraints

- [x] Never edit the user's dirty checkout or existing external vault destructively.
- [x] Do not create a second active memory system; `docs/brain/` is canonical after migration and the external vault is a frozen historical bridge.
- [x] Preserve `.obsidian`, YAML Properties, wikilinks, historical imports, and semantic connections.
- [x] Keep Git authoritative for code and the Second Brain authoritative for operational context, relationships, risks, decisions, and handoff.
- [x] Do not merge, deploy, publish, run remote migrations, or write production data in this task.
- [x] No new production dependency is necessary for the checker.

## Task 1: Validate and install the Second Brain Skill

- [x] Read the full supplied `SKILL.md`, README, and resources.
- [x] Run the Skill creator validator against the installed package.
- [x] Install the exact protocol and resources at `C:/Users/pedro/.codex/skills/piteco-second-brain-protocol/`.
- [x] Preserve the supplied protocol; add only narrowly scoped project integration metadata if the validator or runtime requires it.
- [x] Exercise a pressure scenario and confirm the protocol requires preflight, linked memory updates, and closeout evidence.

## Task 2: Validate and install the Adaptive Learning Skill

- [x] Read the full supplied `SKILL.md`, README, examples, resources, templates, and metadata.
- [x] Install the exact package at `C:/Users/pedro/.codex/skills/piteco-adaptive-learning-loop/`.
- [x] Keep the stable protocol separate from mutable learning memory and require explicit skill-change promotion.
- [x] Validate the installed package and exercise the same pressure scenario with prediction/error/root-cause/retest reporting.

## Task 3: Migrate and normalize the existing Second Brain

- [x] Verify `docs/brain/` is absent in the isolated worktree and copy the existing external vault into it without deleting or overwriting the source.
- [x] Preserve `.obsidian`, red-note CSS, YAML Properties, existing areas, sessions, imports, and historical notes.
- [x] Add a concise canonical-vault/provenance note explaining the repository copy, the frozen external bridge, and Git/code authority.
- [x] Reuse any existing learning-memory structure; otherwise add the supplied `learning/` hub, indexes, folders, and templates without disturbing existing notes.
- [x] Connect the protocol, adaptive learning, current-state, validation, risks, areas, and session notes with meaningful `[[wikilinks]]`.
- [x] Create one small real-task validation record with expectation, evidence, diagnosis, retest, and scoped reusable lesson where justified.

## Task 4: Enforce the workflow in the repository

- [x] Add an `AGENTS.md` section requiring both Skills for every meaningful App Piteco/APE Education engineering task.
- [x] Specify preflight, retrieval of relevant lessons, evidence-backed closeout, single-vault policy, and the final checklists.
- [x] Keep existing publication, Supabase, privacy, mobile, and no-automatic-merge constraints intact.

## Task 5: Prepare and test `brain:check`

- [x] Write a failing focused checker test before implementing the checker.
- [x] Implement a deterministic, non-destructive checker for required core notes, frontmatter structure, unresolved wikilinks, duplicate IDs, `TODO_AGENT`, and session-log presence.
- [x] Add the `brain:check` package script without adding a production dependency.
- [x] Run the focused checker test against a valid fixture and a deliberately invalid fixture.
- [x] Run the checker against the migrated `docs/brain/` and record its output in the session/validation memory.

## Task 6: Review and handoff

- [x] Inspect the complete diff for unintended vault loss, broken links, secrets, or concurrent checkout changes.
- [x] Run relevant repository validation, including typecheck/test/lint as available and the new brain check.
- [x] Perform a local independent diff review; the delegated review timed out and returned no approval or findings.
- [x] Commit the isolated repository changes on the feature branch; do not push or merge unless separately requested.
- [x] Update current state, risks, and handoff notes and report exact install paths, invocation behavior, canonical vault, examples, validation evidence, and remaining limitations.
