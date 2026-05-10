# ADR-001: Use Redis-backed `express-session` instead of JWTs

- **Status:** Accepted
- **Date:** 2026-05-10 *(retroactive — the choice was made early in the project)*
- **Tags:** backend, security, sessions

## Context

VortexFlow needs an authenticated browser session for editing graphs and
running admin operations. The two common approaches in 2025-era Node apps are:

- **Stateful sessions**: server stores the session, client only carries an
  opaque cookie (`session_id`).
- **Stateless tokens**: server signs a JWT, client stores it (cookie or
  localStorage), server verifies on every request.

JWT-based auth is fashionable but commonly mishandled — secret rotation,
revocation lists, refresh-token flows, and storage-side XSS exposure are
all subtle to get right.

## Decision

Use **`express-session` backed by Redis via `connect-redis`**:

- Cookie is `httpOnly`, `secure` in production, `rolling: true` (sliding
  expiration), `maxAge` clamped to ≥ 1 hour.
- Cookie name configurable via `SESSION_NAME` (default `vortexflow-session`).
- Session payload stored server-side in Redis; cookie is opaque.
- No JWT library, no token signing, no refresh flow.

## Consequences

Positive:

- **Revocation is trivial**: drop the Redis key, the user is logged out.
  No blacklist machinery required.
- **No XSS-exfiltration of credentials**: an `httpOnly` cookie is invisible
  to page JS.
- **Minimal moving parts**: one library (`express-session` + `connect-redis`),
  one store. No secret rotation strategy needed.

Negative:

- **Redis is a hard dependency** for any deployment. Down Redis = no
  authentication. Mitigated by the fact that Redis is also useful for caching
  and rate-limiting state.
- **Horizontal scaling requires shared Redis** (already the case here).
- **Cookies don't naturally extend to non-browser API clients** (e.g. CLI
  tools). VortexFlow has no such clients today, so this isn't a real cost.

## Alternatives considered

- **JWT in `httpOnly` cookie**: would have removed the Redis dep but added
  refresh-token complexity, and revocation would require a denylist (= back
  to a stateful store).
- **JWT in localStorage**: classic mistake; XSS-exposed, refused on day one.
- **Passwordless / magic-link auth**: out of scope for the current admin/editor
  workflow. Could be considered later for unauthenticated-friendly views.
