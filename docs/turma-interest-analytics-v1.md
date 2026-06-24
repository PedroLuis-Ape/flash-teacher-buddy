# Turma interest analytics v1

This feature extends the existing registered-student activity panel with a lightweight interest report for public and private classrooms.

## What the teacher sees

- registered students who practiced, with name, sessions, card views and recency;
- anonymous visitor totals without names or profiles;
- sessions and completed sessions;
- most-practiced lists;
- most-practiced cards;
- a conservative interest signal based on recurrence and card practice;
- 7, 30 and 90 day filters.

## Privacy

Guests receive a random browser token. The recording RPC hashes that token with SHA-256 before storage. The raw token, IP address, device fingerprint, email and location are not stored. The report exposes guest data only as aggregates.

## Tracking scope

The study engine records:

- session open;
- displayed card;
- submitted answer when applicable;
- session completion.

Only lists that are actually assigned to the classroom are accepted by the database RPC.

## Deployment

The frontend falls back to the original account-only activity view if the report RPC is not deployed yet. The migration `20260624210000_turma_engagement_analytics_v1.sql` must be applied by the production Lovable Cloud backend during publication.
