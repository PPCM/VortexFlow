# Architecture Decision Records

This directory documents the **why** behind technical choices in VortexFlow.
Decisions that aren't trivially derivable from reading the code go here.

## Format

We use a lightweight MADR-inspired format:

- **Status** — Proposed / Accepted / Superseded by ADR-XXX
- **Date** — when the decision was taken (or, for retroactive ADRs, when it
  was acknowledged in writing)
- **Context** — the situation forcing a choice
- **Decision** — what was chosen
- **Consequences** — what we're now bound to (good and bad)
- **Alternatives considered** — what was looked at and rejected

## Index

| #                                                  | Title                                                                     | Status       |
| -------------------------------------------------- | ------------------------------------------------------------------------- | ------------ |
| [001](./001-redis-session-store.md)                | Use Redis-backed `express-session` instead of JWTs                        | Accepted     |
| [002](./002-browser-side-simulation.md)            | Run particle simulation entirely in the browser                           | Accepted     |
| [003](./003-vite-over-cra.md)                      | Migrate frontend build from CRA to Vite                                   | Accepted     |
| [004](./004-sequelize-sync-vs-migrations.md)       | Use `sequelize.sync({alter})` in dev; migrations as a planned remediation | Transitional |
| [005](./005-dot-3d-triple-invariant.md)            | DOT 3D extensions live in three places that must stay in sync             | Accepted     |
| [006](./006-particle-discrete-event-simulation.md) | Particle simulation moves from continuous animation to DES                | Proposed     |

## Writing a new ADR

1. Copy the template below, name the file `NNN-short-slug.md` with the next
   sequential number.
2. Fill in the sections. Be terse — an ADR is an artifact, not an essay.
3. Add a row to the index above.
4. If the new ADR replaces an older one, mark the older one
   `Superseded by ADR-NNN` and link it.

## Template

```markdown
# ADR-NNN: <decision title>

- **Status:** Accepted
- **Date:** YYYY-MM-DD
- **Tags:** <comma-separated, e.g. backend, security, build>

## Context

<What forced a choice. The constraint, the tradeoff, the deadline.>

## Decision

<What was chosen. One paragraph, plus a bulleted "concretely this means…".>

## Consequences

<Positive and negative outcomes we're now bound to.>

## Alternatives considered

<Bulleted list with one line each: option + why rejected.>
```
