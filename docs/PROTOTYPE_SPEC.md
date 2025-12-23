# Prototype Spec (Idle / Incremental)

## High-level concept (original)
Theme: "Arcane Workshop" (placeholder). Player grows a small workshop into a self-sustaining arcane industry.
No story for now. Focus on numbers + progression.

## Core loop (MVP)
- Resource: Essence (E)
- Passive production: +E per second
- Actions:
  - "Focus" button: gives a small instant E (cooldown-based)
  - Upgrades: increase E/sec or multiply gains
- Milestone:
  - "Ascend" (soft reset) once Essence reaches a threshold; grants permanent “Insight” points to boost future runs.

## Requirements (MVP)
- Deterministic simulation tick (e.g., 20 ticks/sec internal, UI can display per second)
- Offline progress: on load, simulate elapsed time with caps (e.g., max 8h)
- Save/load with schemaVersion and migrations
- Minimal UI:
  - Resource display (Essence, Insight)
  - Current E/sec
  - Progress bar to next milestone
  - Upgrade list (buy button, cost, effect)
  - Dev panel: fast-forward 10s/60s, export/import save JSON

## Non-goals (for MVP)
- No combat, no maps, no complex crafting chains
- No external services, no analytics
