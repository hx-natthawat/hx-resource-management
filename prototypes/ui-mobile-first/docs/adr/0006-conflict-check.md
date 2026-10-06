# ADR-006: Conflict check

Status: Proposed

## Context
Two concurrent bookings can each pass a check and together exceed capacity.

## Decision
Check total weekly hours per person inside the same transaction that writes the booking, locking that person's rows. Materialized view for the heatmap. Every change is an append-only audit event.

## Consequences
Numbers stay correct under concurrency and decisions are traceable. Queries get more complex.
