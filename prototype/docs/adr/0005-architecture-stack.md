# ADR-005: Architecture and stack

Status: Proposed

## Context
Hundreds of users, a small team, fast delivery, possible multi-tenant later, mostly mobile use.

## Decision
Modular monolith in TypeScript: Next.js (mobile-first PWA) and NestJS API, PostgreSQL, containers on cloud with an on-premise option for government. Google Workspace SSO and RBAC. tenant_id on every table from day one.

## Consequences
Simple deploy; modules can split into services later. Adjust before acceptance if the team has a different standard stack.
