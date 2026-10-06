# ADR-002: Booking model

Status: Proposed

## Context
PMs ask people directly, so double bookings stay invisible.

## Decision
Every use of a person starts as a Demand by role and skill, then RM proposes (Soft), then RM confirms (Hard). Only Hard bookings consume capacity. States: Draft, Requested, Proposed, Confirmed, Released, Rejected. See lib/domain/booking.ts.

## Consequences
One extra step for PMs. People are no longer pulled in several directions. Every team needs a named RM.
