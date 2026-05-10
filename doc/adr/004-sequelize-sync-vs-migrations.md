# ADR-004: Use `sequelize.sync({alter})` in dev; migrations as a planned remediation

- **Status:** **Transitional** — see "Decision" for the planned move
- **Date:** 2026-05-10
- **Tags:** backend, database, migrations, debt

## Context

The Sequelize models in `backend/src/models/` are loaded on startup, and
`server.js` calls:

```js
await sequelize.sync({ alter: process.env.NODE_ENV !== 'production' });
```

In non-production environments, this auto-aligns the live schema with the
model definitions — it adds new columns, drops removed ones, and changes
types where it can. It is **never** run in production (because of the
explicit `NODE_ENV !== 'production'` guard).

`sequelize-cli` is installed in `devDependencies` and exposed via
`npm run migrate` / `npm run migrate:undo` scripts in `backend/package.json`.
But there is no `backend/migrations/` directory and no migration files. The
CLI scripts therefore point at nothing.

## Decision

**Today (transitional state)**:

- Dev / test schema continues to be driven by `sync({alter:true})`.
- Production schema is bootstrapped via `scripts/setup-database.js` plus
  ad-hoc DDL. There is no automated migration policy in production.

**Planned remediation** (chantier 1.1 in the audit roadmap):

- Generate the initial migration from the current schema using
  `sequelize-cli migration:create`, populated by reverse-engineering the live
  schema (or by hand from model definitions).
- Switch `server.js` to **never** call `sync()` — even in dev.
  Replace it with `sequelize-cli db:migrate` invoked by:
  - `npm run dev` (or a wrapper) before starting the server, in dev.
  - Production deploy pipeline before booting the new release.
- Document the workflow in `backend/doc/DEVELOPMENT.md`.

This ADR will be marked `Accepted` (no longer transitional) once the
migration directory exists and `sync()` is removed.

## Consequences

Positive (current state):

- **Zero ceremony in dev**: change a model, restart the server, the schema
  follows.
- **Faster iteration on schema changes during prototype work.**

Negative (current state, motivating the planned move):

- **No history of schema changes.** Reverting a schema change requires
  manual DDL.
- **Drift between dev and production possible.** A model edit that
  `sync({alter})` happily applies in dev may require a careful production
  migration that nobody wrote.
- **`sync({alter})` itself is risky.** It will rewrite columns and may lose
  data on type changes — even in dev. There have been no incidents yet, but
  the door is open.
- **Orphaned npm scripts** (`migrate`, `migrate:undo`) make the codebase
  look like it has migrations when it doesn't, confusing readers.

## Alternatives considered

- **Stay on `sync({alter})` forever**: rejected. The negatives compound as
  the schema grows and contributors join.
- **Switch to a different migration tool** (Knex, Umzug standalone, Prisma):
  rejected. `sequelize-cli` is already installed, the team knows Sequelize,
  and the friction-cost of switching ORMs would dominate the gain.
- **Bootstrap migrations on first prod deploy** rather than from current
  state: rejected — there's no current production deployment to migrate
  *from*, and re-deriving schema from models is what `sequelize-cli init` is
  designed to do.
