# Layered Cards Integrity V1 — Design

## Goal

Make layered cards structurally reliable without assigning any grammatical or semantic meaning to a layer.

A layer is only an independent playable A/B pair that the user chose to keep inside the same card group. The application must never require or infer labels such as present, past, future, meaning, formality or grammar type.

## Core model

A valid group contains:

- one internal principal/aggregator row;
- a free user-defined group title;
- at least two ordered layers;
- a non-empty side A and side B in every layer.

The system stores only structure and order. What each layer represents belongs entirely to the user.

## User experience

The existing card editor gains a neutral layered-card editor:

- title: `Camadas do card`;
- explanation: each layer is an independent version of the same card;
- fields per layer: real side A and side B labels from the list;
- optional example and example translation;
- add, remove, move up and move down;
- no semantic label field;
- minimum two layers;
- a standalone card can be converted by using its current A/B pair as layer 1 and adding an empty layer 2.

Saving is a single atomic database operation. Removing or reordering layers is not persisted until the user presses save.

## Persistence

Introduce `public.save_layered_card_group_v2`.

The RPC:

1. validates authentication and list ownership/teacher authorization;
2. accepts an optional principal ID;
3. validates 2–500 layers;
4. validates non-empty A/B content;
5. creates or updates the principal;
6. creates, updates, reorders and soft-deletes children atomically;
7. returns the principal ID and current layer IDs.

No layer category or label is stored.

## Import safety

`createLayeredCard` must use the atomic RPC instead of separate principal and child inserts.

The Super Importer must not fall back to the 1.0 engine when the package contains:

- layered cards;
- glossary entries;
- enriched fields that would be discarded by the 1.0 contract.

In that situation it must stop with a clear backend-incompatible error instead of silently flattening data.

## Compatibility

- existing study behavior based on `parent_card_id` and `layer_index` remains unchanged;
- existing groups require no immediate data migration;
- no compulsory semantic metadata is introduced;
- standalone cards remain valid;
- old simple imports remain compatible when the payload contains only basic A/B pairs.

## Acceptance criteria

1. A user can create arbitrary present/past, meaning-based or any other layer combination without the app interpreting it.
2. Every layer can have a different side A and side B.
3. A group cannot be saved with fewer than two layers.
4. Reordering cannot produce duplicate or stale `layer_index` values.
5. A failed save leaves the previous group unchanged.
6. The old `/import` path creates each layered group atomically.
7. An enriched package is never silently flattened through the 1.0 compatibility RPC.
8. Tests, typecheck, lint, build and database smoke tests pass.