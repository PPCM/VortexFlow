# ADR-005: DOT 3D extensions live in three places that must stay in sync

- **Status:** Accepted
- **Date:** 2026-05-10 *(retroactive — the constraint exists since the
  3D extensions shipped)*
- **Tags:** backend, frontend, dot, contract

## Context

VortexFlow extends the standard DOT (Graphviz) language with attributes for
3D rendering and simulation:

- Legacy flow attributes: `flow_rate, capacity, latency, bandwidth, …`
- 3D extensions: `geometry, dimensions, particleGeneration, particleSpeed, …`
- 3D geometries: `Sphere, Box, Cylinder, Cone, Torus`

These extensions must be:

1. **Accepted by the validator** — otherwise the API rejects user graphs
   that use them.
2. **Read by the renderer** — otherwise validated graphs render without the
   intended 3D effect.
3. **Documented in the spec** — otherwise users can't discover the feature.

The three locations are independent files with no compile-time link between
them. There is no single source of truth that, when changed, would propagate
to the others.

## Decision

Treat the three locations as a **triple invariant** that must be updated
together for every change to the DOT 3D surface:

| Location | Role |
|---|---|
| `backend/src/utils/dotValidator.js` | The gate — whitelist of attributes / shapes / geometries, with per-attribute validation rules |
| `frontend/src/components/graphs/GraphRenderer3D.tsx` | The consumer — reads attributes and applies 3D effects |
| `doc/dot-3d/` | The reference — formal grammar (BNF), validation rules, user guide, examples |

The contract is enforced by **convention and review**, not by tooling.
Adding a new attribute requires touching all three plus a unit test for the
validator and at least one demonstrating example file.

A checklist for adding a new attribute is published in
[`/ARCHITECTURE.md` §9](../../ARCHITECTURE.md) and in the dot-3d
documentation.

## Consequences

Positive:

- **Each location can evolve independently** between formal
  attribute-additions. The renderer can be refactored without touching the
  validator.
- **Each location can be tested independently**: the validator has unit
  tests, the renderer has component tests (with mocked parse responses),
  the spec has prose plus example `.dot` files.
- **The convention is explicit**, documented in two places (ARCHITECTURE
  + this ADR + the dot-3d guide).

Negative:

- **No automated detection of drift.** If a contributor adds an attribute to
  the validator only, no test fails — only review catches it.
- **Three places to remember**, easy to forget the spec.
- **The renderer is a 1500+ line file** (`GraphRenderer3D.tsx`) that already
  carries multiple load-bearing behaviors; adding to it without breaking
  existing behaviors requires care.

## Alternatives considered

- **Single source of truth (TypeScript types or JSON Schema)**, with the
  validator and renderer generated/derived from it: rejected for now.
  The benefit (compile-time consistency) is real, but the cost (build
  pipeline change, codegen step, two-language interop) is high for a project
  of this size.
- **Shared package between backend and frontend** (e.g. `@vortexflow/dot-3d-spec`):
  rejected — the project has no monorepo tooling and adding it for one
  shared file is overkill.
- **Lint rule that scans the three files**: deferred. Could be a useful
  guard in the future but isn't on the critical path.
