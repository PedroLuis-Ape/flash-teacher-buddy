# Layered Cards Integrity V1 — Implementation Plan

## 1. Contract tests

- add pure validation tests for arbitrary A/B layer drafts;
- add migration contract tests for the atomic save RPC;
- update compatibility tests to block lossy fallback for enriched packages.

## 2. Atomic database operation

- add `save_layered_card_group_v2` migration;
- authorize personal-list owners and classroom teachers;
- validate 2–500 layers and non-empty sides;
- create/update/reorder/soft-delete children in one transaction;
- protect current data on any failure;
- add a database smoke workflow.

## 3. Client persistence helper

- make `createLayeredCard` call the RPC;
- expose an update helper for the editor;
- preserve the current merge/unmerge APIs.

## 4. Neutral editor

- edit both A and B for every layer;
- use real list labels;
- remove semantic wording;
- initialize standalone conversion with the current card as layer 1 and an empty layer 2;
- add/remove/reorder locally;
- save the entire group atomically;
- enforce the two-layer minimum.

## 5. Import safety

- detect whether a package needs the rich engine;
- block v1 fallback for layers, glossaries or enriched fields;
- retain v1 fallback only for plain A/B packages.

## 6. Verification

- run focused unit tests;
- run typecheck, full tests, lint and build;
- run Supabase reset and layered RPC smoke test;
- inspect diff for data-loss paths;
- merge only after all checks pass.
